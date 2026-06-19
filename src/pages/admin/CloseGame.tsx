import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eyebrow, PageTitle, SectionLabel } from '@/components/primitives';
import { PopRankingsTable } from '@/components/PopRankingsTable';
import { Toast } from '@/components/Toast';
import { CheckIcon } from '@/components/icons';
import { useAuth } from '@/context/AuthContext';
import { useGame, useSubmissions, useResults } from '@/hooks/data';
import { closeGame, leaderboardFrom } from '@/lib/store';
import { isFirebaseConfigured } from '@/lib/firebase';
import { MOCK_LEADERBOARD } from '@/data/mock';

/** Close Game — tiebreaker entry + final Pop Rankings preview before sending email (PRD §8.4). */
export function CloseGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading } = useGame(gameId);
  const { submissions } = useSubmissions(game, user);
  const results = useResults(gameId);
  const [tiebreaker, setTiebreaker] = useState('');
  const [toastOpen, setToastOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Live preview: rank as if closed, applying the tiebreaker the admin is typing.
  const preview = useMemo(() => {
    if (!game) return [];
    if (!isFirebaseConfigured) return MOCK_LEADERBOARD;
    return leaderboardFrom({ ...game, tiebreakerAnswer: tiebreaker, status: 'CLOSED' }, submissions, results);
  }, [game, submissions, results, tiebreaker]);

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!game) return <p className="text-muted">That game doesn't exist or you don't have access to it.</p>;

  const closed = game.status === 'CLOSED';

  const confirmClose = async () => {
    if (closed) return;
    if (isFirebaseConfigured && gameId) {
      setBusy(true);
      try {
        await closeGame(gameId, tiebreaker);
      } catch {
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setToastOpen(true);
  };

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>Close game</Eyebrow>
        <PageTitle>{game.name}</PageTitle>
      </div>

      <div
        className="flex items-center justify-between gap-4 flex-wrap"
        style={{
          background: 'linear-gradient(180deg,rgba(231,201,47,.08),rgba(231,201,47,.02))',
          border: '1px solid rgba(231,201,47,.28)',
          borderRadius: 14,
          padding: '16px 18px',
          marginBottom: 22,
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 11, letterSpacing: '.12em', color: '#E7C92F', marginBottom: 3 }}>TIEBREAKER ANSWER</div>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: '#C8D4E8' }}>{game.tiebreakerQuestion}</div>
        </div>
        <input
          type="text"
          placeholder="answer"
          value={tiebreaker}
          onChange={(e) => setTiebreaker(e.target.value)}
          style={{
            width: 140,
            textAlign: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            color: '#fff',
            background: 'rgba(0,0,0,.3)',
            border: '1.5px solid rgba(255,255,255,.14)',
            borderRadius: 10,
            padding: '8px 10px',
            outline: 'none',
          }}
        />
      </div>
      <p className="text-muted" style={{ fontSize: 12.5, marginBottom: 22 }}>
        A numeric answer resolves ties by closest value; text resolves by exact match. Earliest submission breaks any remaining tie.
      </p>

      <SectionLabel style={{ marginBottom: 12 }}>Final Pop Rankings preview</SectionLabel>
      <div style={{ marginBottom: 22 }}>
        {preview.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13 }}>No submissions yet — rankings will appear here.</p>
        ) : (
          <PopRankingsTable entries={preview} meUid={user?.uid} showDrops showTiebreaker />
        )}
      </div>

      {closed ? (
        <p className="text-center text-muted" style={{ fontSize: 13.5, padding: '14px 0' }}>
          This challenge is already closed — the standings above are final.
        </p>
      ) : (
        <button
          onClick={confirmClose}
          className="cursor-pointer font-black"
          style={{
            width: '100%',
            fontFamily: 'inherit',
            border: 'none',
            background: '#C0392B',
            color: '#fff',
            fontSize: 16,
            padding: 18,
            borderRadius: 13,
            boxShadow: '0 10px 30px rgba(192,57,43,.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: busy ? 0.6 : 1,
          }}
        >
          <CheckIcon size={18} strokeWidth={2.4} style={{ color: '#fff' }} />
          {busy ? 'Closing…' : 'Confirm close & send Final Pops'}
        </button>
      )}

      <Toast
        open={toastOpen}
        title="Final Pops sent!"
        message="The final Pop Rankings are locked. Final Pops emails are on the way to every player who submitted picks."
        onClose={() => {
          setToastOpen(false);
          navigate('/admin');
        }}
      />
    </div>
  );
}
