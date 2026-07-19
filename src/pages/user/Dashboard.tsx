import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, PageTitle, SectionLabel } from '@/components/primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { Countdown } from '@/components/Countdown';
import { formatEventDate } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useUserGames, useHomeGames, isLocked } from '@/hooks/data';
import { EmptyState } from '@/components/EmptyState';
import { PreviousResults } from '@/components/PreviousResults';
import { GameResultsBoard } from '@/components/GameResultsBoard';

/** User Dashboard — active challenges, the pod's latest result when idle, and your history. */
export function UserDashboard() {
  const { user } = useAuth();
  const { joined, loading } = useUserGames(user);
  const { liveGame, latestClosed } = useHomeGames();
  const navigate = useNavigate();

  // When a game is being scored, land everyone straight on its live board. Only once per
  // game per browser session, so returning to "Your Challenges" doesn't trap you in a loop.
  useEffect(() => {
    if (!liveGame) return;
    const key = `pd-autoopened-${liveGame.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    navigate(`/app/game/${liveGame.id}`, { replace: true });
  }, [liveGame, navigate]);

  const active = joined.filter((j) => j.game.status !== 'CLOSED');
  const previous = joined.filter((j) => j.game.status === 'CLOSED');

  // Pod's latest result, shown inline whenever nothing is live.
  const latestResult = !liveGame && latestClosed && (
    <section style={{ marginTop: active.length > 0 ? 30 : 0 }}>
      <SectionLabel style={{ marginBottom: 14 }}>Latest result</SectionLabel>
      <Card style={{ padding: 22, borderRadius: 16 }}>
        <div className="flex items-baseline justify-between gap-3 flex-wrap" style={{ marginBottom: 16 }}>
          <Link to={`/app/game/${latestClosed.id}`} className="no-underline" style={{ color: 'inherit' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, textTransform: 'uppercase' }}>{latestClosed.name}</span>
          </Link>
          <div className="text-muted" style={{ fontSize: 12.5 }}>
            {latestClosed.promotion.toUpperCase()} · {formatEventDate(latestClosed.eventDate)} · Final
          </div>
        </div>
        <GameResultsBoard gameId={latestClosed.id} />
      </Card>
    </section>
  );

  return (
    <div>
      {/* Join lives in the header, not buried below the game list — it's the one action a
          player needs when the pod posts a new code, and previously it only appeared in the
          empty state, so anyone already in a game had no way to join another. Mirrors the
          title + actions header on All Challenges. */}
      <div className="flex items-end justify-between gap-4 flex-wrap" style={{ marginBottom: 22 }}>
        <PageTitle>Your Challenges</PageTitle>
        <Link
          to="/join"
          className="no-underline font-extrabold"
          style={{
            border: '1.5px solid rgba(119,224,232,.45)',
            background: 'rgba(119,224,232,.12)',
            color: '#77E0E8',
            borderRadius: 11,
            padding: '11px 18px',
            fontSize: 13.5,
            whiteSpace: 'nowrap',
          }}
        >
          + Join a challenge
        </Link>
      </div>

      {loading ? (
        <p className="text-muted">Loading your challenges…</p>
      ) : joined.length === 0 ? (
        <>
          {latestResult}
          <div style={{ marginTop: latestResult ? 24 : 0 }}>
            <EmptyState
              title="Jump into the action"
              body="Got a join code from your pod's organizer? Enter it to play the next challenge."
              ctaLabel="Enter a join code"
              to="/join"
            />
          </div>
        </>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <SectionLabel style={{ marginBottom: 14 }}>Active</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {active.map(({ game: g }) => {
                  // "Open" = still accepting picks. A past-lock game (even if status is still
                  // OPEN) is live/in-progress, so show that instead of a dead countdown.
                  const open = g.status === 'OPEN' && !isLocked(g);
                  return (
                    <Link
                      key={g.id}
                      to={`/app/game/${g.id}`}
                      className="no-underline"
                      style={{
                        background: '#0A1228',
                        border: '1px solid rgba(255,255,255,.07)',
                        borderRadius: 16,
                        padding: 20,
                        display: 'block',
                        color: 'inherit',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-3.5">
                        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', color: '#77E0E8' }}>
                          {g.promotion.toUpperCase()}
                        </span>
                        <StatusBadge status={g.status} />
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, lineHeight: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                        {g.name}
                      </div>
                      <div className="text-muted" style={{ fontSize: 13, marginBottom: 14 }}>
                        {formatEventDate(g.eventDate)} · {g.matches.length + g.propBets.length} picks
                      </div>
                      <div
                        className="flex items-center justify-between"
                        style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 12 }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: '#6B7A99' }}>
                          {open ? 'LOCKS IN' : 'LIVE'}
                        </span>
                        {open ? (
                          <Countdown targetMs={g.lockTime} />
                        ) : (
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#77E0E8' }}>In progress</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {latestResult}

          <PreviousResults items={previous} />
        </>
      )}
    </div>
  );
}
