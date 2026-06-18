import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eyebrow, PageTitle, SectionLabel } from '@/components/primitives';
import { PopRankingsTable } from '@/components/PopRankingsTable';
import { Toast } from '@/components/Toast';
import { CheckIcon } from '@/components/icons';
import { MOCK_GAMES, MOCK_LEADERBOARD, MOCK_CURRENT_USER } from '@/data/mock';

/** Close Game — tiebreaker entry + final Pop Rankings preview before sending email (PRD §8.4). */
export function CloseGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const game = MOCK_GAMES.find((g) => g.id === gameId) ?? MOCK_GAMES[0];
  const [tiebreaker, setTiebreaker] = useState('');
  const [toastOpen, setToastOpen] = useState(false);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>Admin console · Close game</Eyebrow>
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
        <PopRankingsTable entries={MOCK_LEADERBOARD} meUid={MOCK_CURRENT_USER.uid} showDrops showTiebreaker />
      </div>

      <button
        onClick={() => setToastOpen(true)}
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
        }}
      >
        <CheckIcon size={18} strokeWidth={2.4} style={{ color: '#fff' }} />
        Confirm close &amp; send Final Pops
      </button>

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
