import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Game } from '@/types';
import { Card, LiveBanner } from '@/components/primitives';
import { PickButton } from '@/components/PickButton';
import { CheckIcon } from '@/components/icons';
import { useAuth } from '@/context/AuthContext';
import { useResults } from '@/hooks/data';
import { setResult } from '@/lib/store';
import { isFirebaseConfigured } from '@/lib/firebase';

interface Props {
  game: Game;
}

/** ADMIN · LIVE CONTROL — mark each winner (matches + props); the board updates live. */
export function LiveControlPanel({ game }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const results = useResults(game.id);

  // Every gradeable question — matches then prop bets (PRD §4.2).
  const questions = useMemo(
    () => [
      ...game.matches.map((m) => ({ id: m.id, name: m.name, options: m.options })),
      ...game.propBets.map((p) => ({ id: p.id, name: p.question, options: p.options })),
    ],
    [game],
  );
  const called = questions.filter((q) => results[q.id] !== undefined && results[q.id] !== '').length;

  const mark = (questionId: string, option: string) => {
    if (!isFirebaseConfigured || !user) return;
    setResult(game.id, questionId, option, user.uid).catch(() => {});
  };

  return (
    <section>
      <div style={{ marginBottom: 20 }}>
        <LiveBanner
          title="Show is live — picks are locked"
          subtitle="Tap the winner of each pick. Every player's board updates within 3 seconds."
          right={
            <div className="text-right">
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: '#6B7A99' }}>CALLED</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>
                {called}/{questions.length}
              </div>
            </div>
          }
        />
      </div>

      <div className="flex flex-col gap-3" style={{ marginBottom: 24 }}>
        {questions.map((q) => (
          <Card key={q.id} style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', color: '#6B7A99', marginBottom: 12 }}>{q.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: q.options.length > 2 ? '1fr 1fr' : '1fr 1fr', gap: 10 }}>
              {q.options.map((opt) => (
                <PickButton key={opt} showCheck selected={results[q.id] === opt} onClick={() => mark(q.id, opt)}>
                  {opt}
                </PickButton>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <button
        onClick={() => navigate(`/admin/game/${game.id}/close`)}
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
        Enter tiebreaker &amp; close game
      </button>
      <p className="text-center text-muted" style={{ fontSize: 12.5, marginTop: 12 }}>
        Next you'll enter the tiebreaker answer, preview the final Pop Rankings, and send results.
      </p>
    </section>
  );
}
