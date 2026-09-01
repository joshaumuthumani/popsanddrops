import { useMemo, useState } from 'react';
import type { Game, Match } from '@/types';
import { Card, GoldButton, LiveBanner, NightHeading, SectionLabel } from '@/components/primitives';
import { PickButton } from '@/components/PickButton';
import { Countdown } from '@/components/Countdown';
import { Toast } from '@/components/Toast';
import { questionsByDay } from '@/lib/nights';

interface MatchCardProps {
  match: Match;
  selected?: string;
  onPick: (option: string) => void;
}

/** Small "this question changed after you locked in" marker. */
function ChangedTag() {
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: '.08em',
        color: 'var(--color-gold)',
        background: 'rgba(231,201,47,.14)',
        padding: '3px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      CHANGED — RE-PICK
    </span>
  );
}

/** Match name, plus a "pick 1 of N" hint once there are more than two competitors. */
function MatchHeader({ match, centered, flagged }: { match: Match; centered: boolean; flagged?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 flex-wrap ${centered ? 'justify-center' : 'justify-between'}`}
      style={{ marginBottom: 12 }}
    >
      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', color: '#6B7A99' }}>{match.name}</span>
      {flagged && <ChangedTag />}
      {match.options.length > 2 && (
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: '.08em',
            color: '#77E0E8',
            background: 'rgba(119,224,232,.12)',
            padding: '3px 8px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          PICK 1 OF {match.options.length}
        </span>
      )}
    </div>
  );
}

/**
 * The pick controls. Two-competitor matches normally sit side by side with a VS between
 * them; alongside a poster there isn't the width for that, so they stack instead.
 */
function MatchOptions({ match, selected, onPick, stacked }: MatchCardProps & { stacked: boolean }) {
  if (match.options.length > 2) {
    return (
      <div className="flex flex-col gap-2">
        {match.options.map((opt) => (
          <PickButton key={opt} align="left" selected={selected === opt} onClick={() => onPick(opt)}>
            {opt}
          </PickButton>
        ))}
      </div>
    );
  }

  const [a, b] = match.options;
  const vs = (
    <span className="text-center" style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#6B7A99' }}>
      VS
    </span>
  );

  if (stacked) {
    return (
      <div className="flex flex-col" style={{ gap: 7 }}>
        <PickButton selected={selected === a} onClick={() => onPick(a)}>{a}</PickButton>
        {vs}
        <PickButton selected={selected === b} onClick={() => onPick(b)}>{b}</PickButton>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 34px 1fr', gap: 10, alignItems: 'center' }}>
      <PickButton selected={selected === a} onClick={() => onPick(a)}>{a}</PickButton>
      {vs}
      <PickButton selected={selected === b} onClick={() => onPick(b)}>{b}</PickButton>
    </div>
  );
}

/**
 * One match. With a poster the card splits — art on the left, choices stacked on the right
 * (collapsing to poster-on-top when narrow). Without one it renders as it always has.
 */
function MatchCard({ match, selected, onPick, flagged }: MatchCardProps & { flagged?: boolean }) {
  if (!match.posterUrl) {
    return (
      <Card style={{ padding: '16px 18px' }}>
        <MatchHeader match={match} centered={false} flagged={flagged} />
        <MatchOptions match={match} selected={selected} onPick={onPick} stacked={false} />
      </Card>
    );
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div className="poster-split">
        <img className="poster-split__img" src={match.posterUrl} alt={match.name} loading="lazy" />
        <div className="poster-split__body">
          <MatchHeader match={match} centered flagged={flagged} />
          <div className="poster-split__options">
            <MatchOptions match={match} selected={selected} onPick={onPick} stacked />
          </div>
        </div>
      </div>
    </Card>
  );
}

interface Props {
  game: Game;
  initialMatchPicks?: Record<string, string>;
  initialPropPicks?: Record<string, string>;
  initialTiebreaker?: string;
  /** When true, the show has locked — picks are read-only (PRD §4.4). */
  locked?: boolean;
  saving?: boolean;
  /** Question ids a live edit left needing attention (orphaned pick or newly-added question). */
  needsAttention?: string[];
  /** Must reject on failure — the confirmation toast waits on this promise. */
  onSubmit?: (picks: {
    matchPicks: Record<string, string>;
    propBetPicks: Record<string, string>;
    tiebreakerAnswer: string;
  }) => void | Promise<void>;
}

/** USER · MAKE PICKS — two sections + tiebreaker, live countdown, "Lock In Your Picks". */
export function MakePicks({
  game,
  initialMatchPicks = {},
  initialPropPicks = {},
  initialTiebreaker = '',
  locked = false,
  saving = false,
  needsAttention = [],
  onSubmit,
}: Props) {
  const flagged = useMemo(() => new Set(needsAttention), [needsAttention]);
  const [matchPicks, setMatchPicks] = useState<Record<string, string>>(initialMatchPicks);
  const [propPicks, setPropPicks] = useState<Record<string, string>>(initialPropPicks);
  const [tiebreaker, setTiebreaker] = useState(initialTiebreaker);
  const [toastOpen, setToastOpen] = useState(false);
  const [error, setError] = useState('');

  const editable = !locked;
  const setMatch = (id: string, opt: string) => editable && setMatchPicks((p) => ({ ...p, [id]: opt }));
  const setProp = (id: string, opt: string) => editable && setPropPicks((p) => ({ ...p, [id]: opt }));

  const questionCount = game.matches.length + game.propBets.length;
  const picksMade = Object.keys(matchPicks).length + Object.keys(propPicks).length;
  const missingPicks = questionCount - picksMade;
  const missingTiebreaker = tiebreaker.trim() === '';

  // The tiebreaker counts toward progress because you cannot lock in without it. Counting
  // only picks let the bar read "10 of 10" while the button stayed disabled — which is how
  // a player concludes they've submitted when they haven't.
  const total = questionCount + 1;
  const made = picksMade + (missingTiebreaker ? 0 : 1);
  const pct = Math.round((made / total) * 100);
  const allAnswered = missingPicks === 0 && !missingTiebreaker;

  /** Names what's still outstanding. The tiebreaker sits off to one side and is the single
      most-missed input — "answer everything" doesn't tell you that's what you skipped. */
  const missingLabel = !allAnswered
    ? [
        missingPicks > 0 ? `${missingPicks} ${missingPicks === 1 ? 'pick' : 'picks'}` : null,
        missingTiebreaker ? 'the tiebreaker' : null,
      ]
        .filter(Boolean)
        .join(' and ')
    : '';

  /**
   * Only confirm once the save has actually resolved. This used to fire the toast
   * synchronously alongside an un-awaited promise, so a rejected write — rules denial,
   * network drop — looked exactly like success and the player walked away believing
   * their picks were in when nothing had been stored.
   */
  const submit = async () => {
    if (!allAnswered || saving || !onSubmit) return;
    setError('');
    try {
      await onSubmit({ matchPicks, propBetPicks: propPicks, tiebreakerAnswer: tiebreaker });
      setToastOpen(true);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `Couldn't lock in your picks — ${err.message}`
          : "Couldn't lock in your picks. Check your connection and try again.",
      );
    }
  };

  const lockLabel = useMemo(() => new Date(game.lockTime).toLocaleString(), [game.lockTime]);
  // Single-night games come back as one unlabelled group, so the markup below is one path.
  const nights = useMemo(() => questionsByDay(game), [game]);

  return (
    <section>
      <div style={{ marginBottom: 22 }}>
        <LiveBanner
          title={locked ? 'Picks are locked' : 'Get your picks in before the bell'}
          subtitle={
            locked
              ? 'The countdown hit zero — this is a read-only view of your picks.'
              : 'Submit before the countdown hits zero — picks freeze after that.'
          }
          right={
            <div className="text-right" title={lockLabel}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: '#6B7A99' }}>LOCKS IN</div>
              <Countdown targetMs={game.lockTime} />
            </div>
          }
        />
      </div>

      {flagged.size > 0 && (
        <div
          style={{
            background: 'rgba(231,201,47,.1)',
            border: '1px solid rgba(231,201,47,.4)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 18,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 11, letterSpacing: '.12em', color: 'var(--color-gold)', marginBottom: 3 }}>
            THIS GAME CHANGED
          </div>
          <div style={{ fontSize: 13, color: '#C8D4E8' }}>
            {locked
              ? 'An admin changed this game after you locked in. The picks marked below no longer count.'
              : 'An admin changed this game after you locked in. Re-check the picks marked below and lock in again before the countdown ends.'}
          </div>
        </div>
      )}

      {/* progress */}
      <div className="flex items-center gap-3.5" style={{ marginBottom: 18 }}>
        <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
          {/* Scales rather than animating width — width transitions force layout on every frame. */}
          <div
            style={{
              height: '100%',
              width: '100%',
              transform: `scaleX(${pct / 100})`,
              transformOrigin: 'left',
              background: 'linear-gradient(90deg,#E7C92F,#F4DB6B)',
              borderRadius: 4,
              transition: 'transform .35s cubic-bezier(.16,1,.3,1)',
            }}
          />
        </div>
        <span className="font-extrabold whitespace-nowrap" style={{ fontSize: 13, color: '#C8D4E8' }}>
          {made} of {total} locked in
        </span>
      </div>

      {/* QUESTIONS — grouped by night on multi-night cards, ungrouped otherwise. */}
      {nights.map((night) => (
        <div key={night.day}>
          {night.label && <NightHeading label={night.label} />}

          {night.matches.length > 0 && (
            <>
              <SectionLabel style={{ margin: '6px 0 14px' }}>Match predictions · 1 Pop each</SectionLabel>
              <div className="flex flex-col gap-3" style={{ marginBottom: 30 }}>
                {night.matches.map((m) => (
                  <MatchCard key={m.id} match={m} selected={matchPicks[m.id]} onPick={(opt) => setMatch(m.id, opt)} flagged={flagged.has(m.id)} />
                ))}
              </div>
            </>
          )}

          {night.propBets.length > 0 && (
            <>
              <SectionLabel style={{ margin: '6px 0 14px' }}>Prop bets · 1 Pop each</SectionLabel>
              <div className="flex flex-col gap-3" style={{ marginBottom: 18 }}>
                {night.propBets.map((p) => (
                  <Card key={p.id} style={{ padding: '16px 18px' }} className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div style={{ fontWeight: 700, fontSize: 14.5, color: '#C8D4E8' }}>{p.question}</div>
                      {flagged.has(p.id) && <ChangedTag />}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {p.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setProp(p.id, opt)}
                          aria-pressed={propPicks[p.id] === opt}
                          className="cursor-pointer font-extrabold transition-all duration-200"
                          style={{
                            fontFamily: 'inherit',
                            fontSize: 13.5,
                            padding: p.options.length > 2 ? '10px 18px' : '10px 22px',
                            borderRadius: 9,
                            border: `1.5px solid ${propPicks[p.id] === opt ? '#E7C92F' : 'rgba(255,255,255,.1)'}`,
                            background: propPicks[p.id] === opt ? 'rgba(231,201,47,.14)' : 'rgba(255,255,255,.03)',
                            color: propPicks[p.id] === opt ? '#E7C92F' : '#C8D4E8',
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      ))}

      {/* TIEBREAKER */}
      <div
        className="flex items-center justify-between gap-4 flex-wrap"
        style={{
          background: 'linear-gradient(180deg,rgba(231,201,47,.08),rgba(231,201,47,.02))',
          border: '1px solid rgba(231,201,47,.28)',
          borderRadius: 14,
          padding: '16px 18px',
          marginBottom: 26,
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 11, letterSpacing: '.12em', color: '#E7C92F', marginBottom: 3 }}>TIEBREAKER</div>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: '#C8D4E8' }}>{game.tiebreakerQuestion}</div>
        </div>
        <label htmlFor="tiebreaker-input" className="sr-only">{game.tiebreakerQuestion}</label>
        <input
          type="number"
          placeholder="00"
          value={tiebreaker}
          id="tiebreaker-input"
          disabled={locked}
          onChange={(e) => editable && setTiebreaker(e.target.value)}
          style={{
            width: 96,
            textAlign: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            color: '#fff',
            background: 'rgba(0,0,0,.3)',
            border: '1.5px solid rgba(255,255,255,.14)',
            borderRadius: 10,
            padding: '8px 10px',
            outline: 'none',
          }}
        />
      </div>

      {locked ? (
        <p className="text-center text-muted" style={{ fontSize: 13, padding: '14px 0' }}>
          Picks are locked. Head to <strong style={{ color: '#E7C92F' }}>Pop Rankings</strong> to watch the board live.
        </p>
      ) : (
        <>
          <GoldButton full onClick={submit} disabled={!allAnswered || saving} style={{ opacity: allAnswered && !saving ? 1 : 0.6 }}>
            {saving ? 'Locking in…' : 'Lock In Your Picks'}
          </GoldButton>
          {error ? (
            <p className="text-center" style={{ color: '#C0392B', fontSize: 13, marginTop: 12 }}>
              {error}
            </p>
          ) : (
            <p className="text-center text-muted" style={{ fontSize: 12.5, marginTop: 12 }}>
              {allAnswered
                ? 'You can edit your picks until the countdown ends.'
                : `Still need ${missingLabel} before you can lock in.`}
            </p>
          )}
        </>
      )}

      <Toast
        open={toastOpen}
        title="Picks locked in!"
        message="Your picks are in. Come back when the show starts to watch your Pop Count climb the rankings."
        onClose={() => setToastOpen(false)}
      />
    </section>
  );
}
