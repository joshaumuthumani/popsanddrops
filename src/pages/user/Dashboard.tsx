import { Link } from 'react-router-dom';
import { Eyebrow, PageTitle, SectionLabel } from '@/components/primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { Countdown } from '@/components/Countdown';
import { formatEventDate } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useUserGames } from '@/hooks/data';
import { EmptyState } from '@/components/EmptyState';
import { PreviousResults } from '@/components/PreviousResults';

/** User Dashboard — active challenges as cards + a filterable Previous Results list (PRD §8.4). */
export function UserDashboard() {
  const { user } = useAuth();
  const { joined, loading } = useUserGames(user);

  const active = joined.filter((j) => j.game.status !== 'CLOSED');
  const previous = joined.filter((j) => j.game.status === 'CLOSED');

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>User app · Participant</Eyebrow>
        <PageTitle>Your Challenges</PageTitle>
      </div>

      {loading ? (
        <p className="text-muted">Loading your challenges…</p>
      ) : joined.length === 0 ? (
        <EmptyState
          title="No challenges yet"
          body="Got a join code from your pod's organizer? Enter it to jump into a challenge."
          ctaLabel="Enter a join code"
          to="/join"
        />
      ) : (
        <>
          {previous.length > 0 && <SectionLabel style={{ marginBottom: 14 }}>Active</SectionLabel>}
          {active.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13.5 }}>No active challenges right now — your finished ones are below.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
              {active.map(({ game: g }) => {
                const open = g.status === 'OPEN';
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
          )}

          <PreviousResults items={previous} />
        </>
      )}
    </div>
  );
}
