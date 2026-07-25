// Match poster ingest. Two paths, one outcome: a poster image sitting in OUR Storage
// bucket. Direct uploads are downscaled and pushed from the browser; pasted URLs go
// through the ingestPosterFromUrl callable, which fetches and re-hosts them server-side
// (the browser can't fetch arbitrary third-party images — CORS).
//
// Nothing here ever hands back a third-party URL. See
// docs/superpowers/specs/2026-07-18-match-posters-design.md.

import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { functions, storage } from '@/lib/firebase';

/** Mirrors the cap enforced in storage.rules — keep the two in sync. */
export const MAX_POSTER_BYTES = 5 * 1024 * 1024;

/** Posters render in a ~600px-wide card at most; 1200 covers 2x displays. */
const POSTER_MAX_WIDTH = 1200;
const POSTER_JPEG_QUALITY = 0.85;

/** A failure we can show the admin verbatim, per match. */
export class PosterError extends Error {}

/** Draws `file` into a canvas no wider than POSTER_MAX_WIDTH and re-encodes it as JPEG. */
async function downscaleToJpeg(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new PosterError("That file doesn't look like an image we can read."));
      el.src = objectUrl;
    });

    const scale = Math.min(1, POSTER_MAX_WIDTH / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PosterError('Could not process that image in this browser.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', POSTER_JPEG_QUALITY),
    );
    if (!blob) throw new PosterError('Could not process that image. Try a different file.');
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Downscales `file` and uploads it to posters/{uid}/{imageId}.jpg.
 * Returns the Storage download URL to store on the match.
 */
export async function uploadPosterFile(file: File, uid: string): Promise<string> {
  if (!storage) throw new PosterError('Uploads need a live Firebase connection.');
  if (!file.type.startsWith('image/')) throw new PosterError('Pick an image file (JPG, PNG, WebP).');
  if (file.size > MAX_POSTER_BYTES) throw new PosterError('That image is over 5 MB. Try a smaller one.');

  const jpeg = await downscaleToJpeg(file);
  const objectRef = ref(storage, `posters/${uid}/${crypto.randomUUID()}.jpg`);
  try {
    await uploadBytes(objectRef, jpeg, { contentType: 'image/jpeg' });
    return await getDownloadURL(objectRef);
  } catch (err) {
    throw storageFailure(err);
  }
}

/**
 * Turns an opaque Firebase Storage error into a message the admin can act on. Without this,
 * every Storage failure — a missing bucket config, undeployed rules, an expired session —
 * collapses into the same generic "Something went wrong", which is impossible to debug from
 * the live site. The raw code is also logged so it is visible in the browser console.
 */
function storageFailure(err: unknown): PosterError {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  // eslint-disable-next-line no-console
  console.error('[poster upload] failed', code || err, err);

  switch (code) {
    case 'storage/unauthorized':
      return new PosterError(
        "Storage blocked this upload. Deploy storage.rules (firebase deploy --only storage) and confirm you're signed in as an admin.",
      );
    case 'storage/no-default-bucket':
    case 'storage/unknown':
      return new PosterError(
        "This site's Storage bucket isn't set. Check VITE_FIREBASE_STORAGE_BUCKET matches the bucket in Firebase Console → Storage, then rebuild.",
      );
    case 'storage/unauthenticated':
      return new PosterError('Your session expired. Sign in again, then retry the upload.');
    case 'storage/retry-limit-exceeded':
    case 'storage/canceled':
      return new PosterError('Upload timed out. Check your connection and try again.');
    default:
      return new PosterError(code ? `Upload failed (${code}).` : 'Upload failed. Try again.');
  }
}

/**
 * Hands a third-party image URL to the Cloud Function, which fetches, validates, downscales,
 * and re-hosts it. Returns the Storage download URL — never the URL that was passed in.
 */
export async function ingestPosterUrl(url: string): Promise<string> {
  if (!functions) throw new PosterError('Adding by link needs a live Firebase connection.');

  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new PosterError('Paste a full image link starting with http:// or https://');
  }

  const callable = httpsCallable<{ url: string }, { posterUrl: string }>(functions, 'ingestPosterFromUrl');
  let res: HttpsCallableResult<{ posterUrl: string }>;
  try {
    res = await callable({ url: trimmed });
  } catch (err) {
    // Functions errors carry our thrown message; anything else gets a generic fallback.
    const message = err instanceof Error ? err.message : '';
    throw new PosterError(message || "Couldn't fetch that image. Try uploading the file instead.");
  }
  return res.data.posterUrl;
}
