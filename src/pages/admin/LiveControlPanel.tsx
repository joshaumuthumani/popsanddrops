import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Game } from '@/types';
import { Card, LiveBanner, NightHeading, SectionLabel } from '@/components/primitives';
import { questionsByDay } from '@/lib/nights';
import { PickButton } from '@/components/PickButton';
import { CheckIcon } from '@/components/icons';
import { useAuth } from '@/context/AuthContext';
import { useResults } from '@/hooks/data';
import { sendNightStandings, setResult } from '@/lib/store';
import { isFirebaseConfigured } from '@/lib/firebase';
import { nightCount } from '@/lib/nights';

interface Props {
  game: Game;
  /** Closed games are final — results display read-only and can't be changed (PRD §4.6). */
  readOnly?: boolean;
}

/**
 * "Send Night N standings" — only for non-final nights of a multi-night card. The final
 * night's report is the results email that goes out when the game is closed.
 *
 * The disabled states here are a convenience. Every rule that matters (admin role, night
 * fully graded, not already sent) is enforced again in the callable, because the failure
 * mode is emailing the whole pod twice.
 */
function NightStandingsButton({
  game,
  night,
}: {
  game: Game;
  night: { day: number; questions: { id: string }[] };
}) {
  const results = useResults(game.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const isFinalNight = night.day >= nightCount(game);
  if (isFinalNight) return null; // covered by the close-game results email

  const alreadySent = sent || (game.standingsSentFor ?? []).includes(night.day);
  const ungraded = night.questions.filter((q) => !results[q.id]).length;
  const live = isFirebaseConfigured;
  const canSend = live && !alreadySent && ungraded === 0 && !busy;

  const send = async () => {
    setError('');
    setBusy(true);
    try {
      await sendNightStandings(game.id, night.day);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send standings.');
    } finally {
      setBusy(false);
    }
  };

  const label = alreadySent
    ? `Night ${night.day} standings sent`
    : busy
      ? 'Sending…'
      : `Send Night ${night.day} standings`;

  return (
    <div style={{ marginTop: 14 }}>
      <button
        onClick={send}
        disabled={!canSend}
        className="cursor-pointer font-extrabold"
        style={{
          fontFamily: 'inherit',
          fontSize: 13.5,
          padding: '11px 18px',
          borderRadius: 10,
          border: `1.5px solid ${canSend ? 'rgba(119,224,232,.45)' : 'rgba(255,255,255,.12)'}`,
          background: canSend ? 'rgba(119,224,232,.12)' : 'transparent',
          color: canSend ? '#77E0E8' : '#6B7A99',
          cursor: canSend ? 'pointer' : 'default',
        }}
      >
        {label}
      </button>
      {!alreadySent && ungraded > 0 && (
        <p style={{ color: '#6B7A99', fontSize: 12, marginTop: 6 }}>
          {ungraded} more {ungraded === 1 ? 'result' : 'results'} to call before Night {night.day}{' '}
          standings can go out.
        </p>
      )}
      {!live && (
        <p style={{ color: '#6B7A99', fontSize: 12, marginTop: 6 }}>
          Sending standings needs a live Firebase connection — unavailable in demo mode.
        </p>
      )}
      {error && <p style={{ color: '#C0392B', fontSize: 12, marginTop: 6 }}>{error}</p>}
    </div>
  );
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
      questionsByDay(game).map((n) => {
        const matches = n.matches.map((m) => ({ id: m.id, name: m.name, options: m.options }));
        const props = n.propBets.map((p) => ({ id: p.id, name: p.question, options: p.options }));
        return { ...n, matches, props, questions: [...matches, ...props] };
      }),
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
          {/* Matches and props are graded the same way but are different kinds of question —
              label them so an admin calling results mid-show knows which list they're in. */}
          {([
            { title: 'Match predictions', items: night.matches },
            { title: 'Prop bets', items: night.props },
          ] as const).map(
            ({ title, items }) =>
              items.length > 0 && (
                <div key={title} style={{ marginBottom: 18 }}>
                  <SectionLabel style={{ margin: '2px 0 12px' }}>{title}</SectionLabel>
                  <div className="flex flex-col gap-3">
                    {items.map((q) => (
                      <Card key={q.id} style={{ padding: '16px 18px' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', color: '#6B7A99', marginBottom: 12 }}>{q.name}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
              ),
          )}
          {!readOnly && <NightStandingsButton game={game} night={night} />}
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
