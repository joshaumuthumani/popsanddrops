import { useEffect, useRef, useState } from 'react';
import { PosterError, ingestPosterUrl, uploadPosterFile } from '@/lib/posters';
import { isFirebaseConfigured } from '@/lib/firebase';

interface Props {
  /** Current poster (a Storage URL), or undefined when the match has none. */
  value?: string;
  onChange: (posterUrl: string | undefined) => void;
  /** Uploading admin's uid — posters are stored under posters/{uid}/. */
  uid?: string;
  /**
   * Reports whether a link is typed-but-not-yet-hosted (or mid-fetch), so the builder can
   * refuse to publish and silently drop it.
   */
  onPendingChange?: (pending: boolean) => void;
}

const ghostButton = {
  border: '1.5px dashed rgba(255,255,255,.16)',
  color: '#6B7A99',
  borderRadius: 9,
  padding: '8px 14px',
  fontWeight: 800,
  fontSize: 13,
  fontFamily: 'inherit',
} as const;

const urlInput = {
  flex: 1,
  minWidth: 150,
  background: 'rgba(0,0,0,.3)',
  border: '1.5px solid rgba(255,255,255,.12)',
  borderRadius: 9,
  padding: '8px 11px',
  color: '#F5F5F5',
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
} as const;

/**
 * Match-poster control for the Game Builder. Both ingest paths land on a Storage URL,
 * so this component only ever hands `onChange` something from our own bucket.
 *
 * The preview is doing real work: it shows the same 16:9 crop the picks screen will use,
 * which is the admin's chance to swap a poster that crops badly.
 */
export function PosterPicker({ value, onChange, uid, onPendingChange }: Props) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<'upload' | 'link' | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // A link sitting in the box is unsaved work — the builder needs to know so publishing
  // can't quietly throw it away.
  const pending = busy !== null || url.trim() !== '';
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  // Retract the flag when this picker goes away, so no stale "pending" entry outlives the row.
  //
  // Defence in depth, not the primary fix: QuestionBuilder.remove() clears the flag directly,
  // and publish counts only questions still present, so either of those alone would prevent a
  // removed row from blocking publish. This covers any future unmount path that forgets to.
  //
  // Unmount only. Keying this to `pending` would retract the flag whenever that boolean flips
  // (empty↔non-empty, or a busy transition) and immediately re-set it — churn for no gain.
  // Safe despite the frozen closure because `onPendingChange` only ever closes over a stable
  // q.id feeding a stable state setter; if that ever changes, this needs revisiting, and
  // nothing will warn you.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => onPendingChange?.(false), []);

  // Both paths need Storage/Functions, neither of which exists in Phase-0 demo mode.
  const live = isFirebaseConfigured && Boolean(uid);

  const run = async (kind: 'upload' | 'link', work: () => Promise<string>) => {
    setError('');
    setBusy(kind);
    try {
      onChange(await work());
      setUrl('');
    } catch (err) {
      setError(err instanceof PosterError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const pickFile = (file: File | undefined) => {
    if (!file || !uid) return;
    void run('upload', () => uploadPosterFile(file, uid));
  };

  if (value) {
    return (
      <div style={{ marginBottom: 12 }}>
        <img
          src={value}
          alt="Match poster preview"
          // Sized to roughly match the poster column on the picks screen, so the admin sees
          // the same 16:9 framing players will get.
          style={{
            width: '100%',
            maxWidth: 420,
            aspectRatio: '16 / 9',
            objectFit: 'cover',
            borderRadius: 9,
            border: '1px solid rgba(255,255,255,.1)',
            display: 'block',
          }}
        />
        <div className="flex gap-2" style={{ marginTop: 8 }}>
          <button onClick={() => fileRef.current?.click()} className="cursor-pointer bg-transparent" style={ghostButton} disabled={busy !== null}>
            {busy === 'upload' ? 'Uploading…' : 'Replace'}
          </button>
          <button onClick={() => onChange(undefined)} className="cursor-pointer bg-transparent" style={ghostButton}>
            Remove
          </button>
        </div>
        {error && <p style={{ color: '#C0392B', fontSize: 12, marginTop: 6 }}>{error}</p>}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer bg-transparent"
          style={{ ...ghostButton, opacity: live && !busy ? 1 : 0.5 }}
          disabled={!live || busy !== null}
        >
          {busy === 'upload' ? 'Uploading…' : '+ Poster image'}
        </button>
        <input
          placeholder="…or paste an image link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          // Fetch on blur and on Enter as well as via Add. Requiring the button meant a
          // pasted link that looked accepted was silently dropped at publish.
          onBlur={() => url.trim() && !busy && void run('link', () => ingestPosterUrl(url))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && url.trim() && !busy) {
              e.preventDefault();
              void run('link', () => ingestPosterUrl(url));
            }
          }}
          disabled={!live || busy !== null}
          style={{ ...urlInput, opacity: live ? 1 : 0.5 }}
        />
        <button
          onClick={() => void run('link', () => ingestPosterUrl(url))}
          className="cursor-pointer bg-transparent"
          style={{ ...ghostButton, opacity: live && url.trim() && !busy ? 1 : 0.5 }}
          disabled={!live || !url.trim() || busy !== null}
        >
          {busy === 'link' ? 'Fetching…' : 'Add'}
        </button>
      </div>

      {!live && (
        <p style={{ color: '#6B7A99', fontSize: 12, marginTop: 6 }}>
          Posters need a live Firebase connection — unavailable in demo mode.
        </p>
      )}
      {error && <p style={{ color: '#C0392B', fontSize: 12, marginTop: 6 }}>{error}</p>}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
    </div>
  );
}
