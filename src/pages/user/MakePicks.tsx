import { useMemo, useState } from 'react';
import type { Game, Match } from '@/types';
import { Card, GoldButton, LiveBanner, SectionLabel } from '@/components/primitives';
import { PickButton } from '@/components/PickButton';
import { Countdown } from '@/components/Countdown';
import { Toast } from '@/components/Toast';

interface MatchCardProps {
  match: Match;
  selected?: string;
  onPick: (option: string) => void;
}

/** Match name, plus a "pick 1 of N" hint once there are more than two competitors. */
function MatchHeader({ match, centered }: { match: Match; centered: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 flex-wrap ${centered ? 'justify-center' : 'justify-between'}`}
      style={{ marginBottom: 12 }}
    >
      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', color: '#6B7A99' }}>{match.name}</span>
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
function MatchCard({ match, selected, onPick }: MatchCardProps) {
  if (!match.posterUrl) {
    return (
      <Card style={{ padding: '16px 18px' }}>
        <MatchHeader match={match} centered={false} />
        <MatchOptions match={match} selected={selected} onPick={onPick} stacked={false} />
      </Card>
    );
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div className="poster-split">
        <img className="poster-split__img" src={match.posterUrl} alt={match.name} loading="lazy" />
        <div className="poster-split__body">
          <MatchHeader match={match} centered />
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
  onSubmit?: (picks: {
    matchPicks: Record<string, string>;
    propBetPicks: Record<string, string>;
    tiebreakerAnswer: string;
  }) => void;
}

/** USER · MAKE PICKS — two sections + tiebreaker, live countdown, "Lock In Your Picks". */
export function MakePicks({
  game,
  initialMatchPicks = {},
  initialPropPicks = {},
  initialTiebreaker = '',
  locked = false,
  saving = false,
  onSubmit,
}: Props) {
  const [matchPicks, setMatchPicks] = useState<Record<string, string>>(initialMatchPicks);
  const [propPicks, setPropPicks] = useState<Record<string, string>>(initialPropPicks);
  const [tiebreaker, setTiebreaker] = useState(initialTiebreaker);
  const [toastOpen, setToastOpen] = useState(false);

  const editable = !locked;
  const setMatch = (id: string, opt: string) => editable && setMatchPicks((p) => ({ ...p, [id]: opt }));
  const setProp = (id: string, opt: string) => editable && setPropPicks((p) => ({ ...p, [id]: opt }));

  const total = game.matches.length + game.propBets.length;
  const made = Object.keys(matchPicks).length + Object.keys(propPicks).length;
  const pct = Math.round((made / total) * 100);
  const allAnswered = made === total && tiebreaker.trim() !== '';

  const submit = () => {
    if (!allAnswered || saving || !onSubmit) return;
    onSubmit({ matchPicks, propBetPicks: propPicks, tiebreakerAnswer: tiebreaker });
    setToastOpen(true);
  };

  const lockLabel = useMemo(() => new Date(game.lockTime).toLocaleString(), [game.lockTime]);

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

      {/* progress */}
      <div className="flex items-center gap-3.5" style={{ marginBottom: 18 }}>
        <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: 'linear-gradient(90deg,#E7C92F,#F4DB6B)',
              borderRadius: 4,
              transition: 'width .35s cubic-bezier(.16,1,.3,1)',
            }}
          />
        </div>
        <span className="font-extrabold whitespace-nowrap" style={{ fontSize: 13, color: '#C8D4E8' }}>
          {made} of {total} locked in
        </span>
      </div>

      {/* MATCH PREDICTIONS */}
      <SectionLabel style={{ margin: '6px 0 14px' }}>Match predictions · 1 Pop each</SectionLabel>
      <div className="flex flex-col gap-3" style={{ marginBottom: 30 }}>
        {game.matches.map((m) => (
          <MatchCard key={m.id} match={m} selected={matchPicks[m.id]} onPick={(opt) => setMatch(m.id, opt)} />
        ))}
      </div>

      {/* PROP BETS */}
      <SectionLabel style={{ margin: '6px 0 14px' }}>Prop bets · 1 Pop each</SectionLabel>
      <div className="flex flex-col gap-3" style={{ marginBottom: 18 }}>
        {game.propBets.map((p) => (
          <Card key={p.id} style={{ padding: '16px 18px' }} className="flex items-center justify-between gap-4 flex-wrap">
            <div style={{ fontWeight: 700, fontSize: 14.5, color: '#C8D4E8' }}>{p.question}</div>
            <div className="flex gap-2 flex-wrap">
              {p.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setProp(p.id, opt)}
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
        <input
          type="number"
          placeholder="00"
          value={tiebreaker}
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
          <GoldButton full onClick={submit} style={{ opacity: allAnswered && !saving ? 1 : 0.6 }}>
            {saving ? 'Locking in…' : 'Lock In Your Picks'}
          </GoldButton>
          <p className="text-center text-muted" style={{ fontSize: 12.5, marginTop: 12 }}>
            {allAnswered ? 'You can edit your picks until the countdown ends.' : `Answer all ${total} picks + the tiebreaker to lock in.`}
          </p>
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
