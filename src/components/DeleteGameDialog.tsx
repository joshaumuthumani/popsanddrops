import { useState } from 'react';
import { Card } from '@/components/primitives';
import { deleteGameById } from '@/lib/store';
import { isFirebaseConfigured } from '@/lib/firebase';
import type { Game } from '@/types';

/**
 * Type-to-confirm delete for a game. Hard and irreversible (Admin-SDK recursiveDelete), so the
 * button only arms once the operator types the game's exact name — the GitHub "delete repo"
 * pattern. Degrades visibly in demo mode. Failures surface; never a silent no-op.
 */
export function DeleteGameDialog({
  game,
  playerCount,
  onClose,
  onDeleted,
}: {
  game: Game;
  playerCount: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const armed = typed.trim() === game.name.trim() && isFirebaseConfigured && !busy;

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteGameById(game.id);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the game.');
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <Card style={{ padding: 24, maxWidth: 460, width: '90%' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8 }}>Delete “{game.name}”?</h3>
        <p style={{ color: '#C0392B', fontSize: 13, marginBottom: 10 }}>
          This permanently removes the game and everything under it: {playerCount}{' '}
          {playerCount === 1 ? "player's picks" : "players' picks"}, all results, the leaderboard,
          and the email log. This cannot be undone.
        </p>
        {!isFirebaseConfigured && (
          <p style={{ color: '#6B7A99', fontSize: 12, marginBottom: 10 }}>
            Deleting needs a live Firebase connection — unavailable in demo mode.
          </p>
        )}
        <label style={{ fontSize: 12, color: '#6B7A99' }}>Type the game name to confirm</label>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={game.name}
          style={{
            width: '100%',
            background: 'rgba(0,0,0,.3)',
            border: '1.5px solid rgba(255,255,255,.12)',
            borderRadius: 10,
            padding: '11px 13px',
            color: '#F5F5F5',
            fontFamily: 'inherit',
            fontSize: 14,
            outline: 'none',
            margin: '6px 0 14px',
          }}
        />
        {error && <p style={{ color: '#C0392B', fontSize: 12, marginBottom: 8 }}>{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={run}
            disabled={!armed}
            className="cursor-pointer font-black"
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 12,
              padding: 14,
              background: armed ? '#C0392B' : 'rgba(192,57,43,.35)',
              color: '#fff',
              cursor: armed ? 'pointer' : 'default',
            }}
          >
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
          <button
            onClick={onClose}
            className="cursor-pointer bg-transparent font-extrabold"
            style={{ border: '1.5px solid rgba(255,255,255,.16)', color: '#F5F5F5', borderRadius: 12, padding: '0 22px' }}
          >
            Cancel
          </button>
        </div>
      </Card>
    </div>
  );
}
