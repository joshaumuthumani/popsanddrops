import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Game } from '@/types';
import { Card, LiveBanner, NightHeading } from '@/components/primitives';
import { questionsByDay } from '@/lib/nights';
import { PickButton } from '@/components/PickButton';
import { CheckIcon } from '@/components/icons';
import { useAuth } from '@/context/AuthContext';
import { useResults } from '@/hooks/data';
import { setResult } from '@/lib/store';
import { isFirebaseConfigured } from '@/lib/firebase';

interface Props {
  game: Game;
  /** Closed games are final — results display read-only and can't be changed (PRD §4.6). */
  readOnly?: boolean;
}

/** ADMIN · LIVE CONTROL — mark each winner (matches + props); the board updates live. */
export function LiveControlPanel({ game, readOnly = false }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const results = useResults(game.id);

  // Every gradeable question, grouped by night — matches then prop bets (PRD §4.2).
  // Single-night games come back as one unlabelled group, so the markup is one path.
  const nights = useMemo(
    () =>
      questionsByDay(game).map((n) => ({
        ...n,
        questions: [
          ...n.matches.map((m) => ({ id: m.id, name: m.name, options: m.options })),
          ...n.propBets.map((p) => ({ id: p.id, name: p.question, options: p.options })),
        ],
      })),
    [game],
  );
  const questions = useMemo(() => nights.flatMap((n) => n.questions), [nights]);
  const called = questions.filter((q) => results[q.id] !== undefined && results[q.id] !== '').length;

  const mark = (questionId: string, option: string) => {
    if (readOnly || !isFirebaseConfigured || !user) return;
    setResult(game.id, questionId, option, user.uid).catch(() => {});
  };

  return (
    <section>
      <div style={{ marginBottom: 20 }}>
        <LiveBanner
          title={readOnly ? 'Challenge closed — results are final' : 'Show is live — picks are locked'}
          subtitle={
            readOnly
              ? 'This game is closed. Winners are locked and can no longer be changed.'
              : 'Tap the winner of each pick. Every player’s board updates within 3 seconds.'
          }
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

      {nights.map((night) => (
        <div key={night.day} style={{ marginBottom: 24 }}>
          {night.label && <NightHeading label={night.label} />}
          <div className="flex flex-col gap-3">
            {night.questions.map((q) => (
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
        </div>
      ))}

      {readOnly ? (
        <p className="text-center text-muted" style={{ fontSize: 13, padding: '10px 0' }}>
          This challenge is final. See <strong style={{ color: '#E7C92F' }}>Players</strong> for everyone’s picks.
        </p>
      ) : (
        <>
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
        </>
      )}
    </section>
  );
}
