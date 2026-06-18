import { Link, useNavigate } from 'react-router-dom';
import { Eyebrow, PageTitle, GoldButton } from '@/components/primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { formatEventDate } from '@/lib/format';
import { MOCK_GAMES } from '@/data/mock';

/** Admin Dashboard — list of all games across all promotions + Create New Game (PRD §8.4). */
export function AdminGames() {
  const navigate = useNavigate();
  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap" style={{ marginBottom: 22 }}>
        <div>
          <Eyebrow>Admin console · Organizer</Eyebrow>
          <PageTitle>All Challenges</PageTitle>
        </div>
        <GoldButton onClick={() => navigate('/admin/new')} style={{ fontSize: 14.5, padding: '14px 22px', borderRadius: 11 }}>
          + Create new game
        </GoldButton>
      </div>

      <div className="flex flex-col gap-3">
        {MOCK_GAMES.map((g) => (
          <Link
            key={g.id}
            to={`/admin/game/${g.id}`}
            className="no-underline flex items-center justify-between gap-4 flex-wrap"
            style={{
              background: '#0A1228',
              border: '1px solid rgba(255,255,255,.07)',
              borderRadius: 14,
              padding: '18px 20px',
              color: 'inherit',
            }}
          >
            <div className="flex items-center gap-4 flex-wrap">
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', color: '#77E0E8', minWidth: 48 }}>
                {g.promotion.toUpperCase()}
              </span>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1, textTransform: 'uppercase' }}>{g.name}</div>
                <div className="text-muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                  {formatEventDate(g.eventDate)} · {g.matches.length} matches · {g.propBets.length} props
                </div>
              </div>
            </div>
            <StatusBadge status={g.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}
