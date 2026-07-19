// ingestPosterFromUrl — re-hosts a pasted image link into our own Storage bucket.
//
// Why this exists at all: storing the pasted URL directly would make the picks screen
// permanently dependent on someone else's CDN (hotlink blocking, expiring social-media
// URLs, link rot). Fetching it here and re-hosting removes that whole class of failure.
//
// This is a server fetching a URL supplied by a caller, so it is an SSRF surface and is
// guarded accordingly: admin-only, http(s)-only, public-IP-only, byte-capped, time-capped,
// and content-type verified. See docs/superpowers/specs/2026-07-18-match-posters-design.md.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import sharp from 'sharp';

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const POSTER_MAX_WIDTH = 1200;

/**
 * True for addresses that must never be fetched: loopback, link-local (incl. the cloud
 * metadata endpoint at 169.254.169.254), private, and unspecified ranges.
 */
function isBlockedAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    return false;
  }

  if (version === 6) {
    const addr = address.toLowerCase();
    if (addr === '::' || addr === '::1') return true;
    if (addr.startsWith('fe80') || addr.startsWith('fc') || addr.startsWith('fd')) return true;
    // IPv4-mapped (::ffff:10.0.0.1) — re-check the embedded v4 address.
    const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedAddress(mapped[1]);
    return false;
  }

  return true; // unparseable — refuse
}

/** Rejects the URL unless it is http(s) and every address its host resolves to is public. */
async function assertFetchableUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpsError('invalid-argument', "That doesn't look like a valid link.");
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new HttpsError('invalid-argument', 'Image links must start with http:// or https://');
  }

  // NOTE: this is a resolve-then-fetch check, so a DNS-rebinding attacker could in principle
  // return a public address here and a private one to the fetch below. Closing that fully
  // means pinning the connection to the resolved IP; given this endpoint is admin-only, the
  // range check plus admin gating is the accepted trade-off.
  let addresses: { address: string }[];
  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    throw new HttpsError('invalid-argument', "Couldn't reach that link's host.");
  }

  if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
    throw new HttpsError('invalid-argument', 'That link points somewhere we cannot fetch.');
  }

  return url;
}

/** Reads the body with a hard byte ceiling, aborting rather than buffering a huge response. */
async function readCapped(res: Response): Promise<Buffer> {
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) {
    throw new HttpsError('invalid-argument', 'That image is over 5 MB. Try a smaller one.');
  }

  const reader = res.body?.getReader();
  if (!reader) throw new HttpsError('invalid-argument', 'That link returned no image data.');

  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new HttpsError('invalid-argument', 'That image is over 5 MB. Try a smaller one.');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/** Follows redirects by hand so the SSRF guard runs on every hop, not just the first. */
async function fetchImage(startUrl: string): Promise<Buffer> {
  let target = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertFetchableUrl(target);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, { redirect: 'manual', signal: controller.signal });
    } catch {
      throw new HttpsError('unavailable', "Couldn't fetch that image. Try uploading the file instead.");
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new HttpsError('unavailable', 'That link redirected somewhere we cannot follow.');
      target = new URL(location, url).toString();
      continue;
    }

    if (!res.ok) {
      throw new HttpsError('unavailable', `That link returned an error (${res.status}).`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      throw new HttpsError('invalid-argument', "That link isn't an image — check you copied the image address.");
    }

    return readCapped(res);
  }

  throw new HttpsError('unavailable', 'That link redirected too many times.');
}

/**
 * Fetches a third-party image, normalizes it, and stores it under posters/{uid}/.
 * Returns a Firebase Storage download URL in the same format the client SDK produces.
 */
export const ingestPosterFromUrl = onCall<{ url?: string }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to add a poster.');

  const profile = await getFirestore().doc(`users/${uid}`).get();
  const role = profile.data()?.role;
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Only admins can add match posters.');
  }

  const raw = request.data?.url;
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new HttpsError('invalid-argument', 'Paste an image link first.');
  }

  const source = await fetchImage(raw.trim());

  let jpeg: Buffer;
  try {
    jpeg = await sharp(source)
      .resize({ width: POSTER_MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (err) {
    logger.warn('poster ingest: unreadable image', { uid, err });
    throw new HttpsError('invalid-argument', "We couldn't read that image. Try uploading the file instead.");
  }

  // A download token makes the object readable at the same URL shape getDownloadURL() returns,
  // so the client can't tell the two ingest paths apart.
  const token = randomUUID();
  const path = `posters/${uid}/${randomUUID()}.jpg`;
  const bucket = getStorage().bucket();
  await bucket.file(path).save(jpeg, {
    contentType: 'image/jpeg',
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });

  const posterUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
    `/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

  logger.info('poster ingested from url', { uid, bytes: jpeg.byteLength });
  return { posterUrl };
});
