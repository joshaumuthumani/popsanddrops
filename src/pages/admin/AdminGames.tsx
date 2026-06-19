import { Link, useNavigate } from 'react-router-dom';
import { PageTitle, GoldButton } from '@/components/primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { formatEventDate } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useAdminGames } from '@/hooks/data';

/** Admin Dashboard — list of all games across all promotions + Create New Game (PRD §8.4). */
export function AdminGames() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { games, loading } = useAdminGames(user);
  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap" style={{ marginBottom: 22 }}>
        <div>
          <PageTitle>All Challenges</PageTitle>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {user?.role === 'superadmin' && (
            <Link
              to="/admin/manage"
              className="no-underline font-extrabold"
              style={{
                fontSize: 14,
                padding: '13px 18px',
                borderRadius: 11,
                border: '1.5px solid rgba(255,255,255,.16)',
                color: '#F5F5F5',
              }}
            >
              Manage admins
            </Link>
          )}
          <GoldButton onClick={() => navigate('/admin/new')} style={{ fontSize: 14.5, padding: '14px 22px', borderRadius: 11 }}>
            + Create new game
          </GoldButton>
        </div>
      </div>

      {loading ? (
        <p className="text-muted">Loading challenges…</p>
      ) : games.length === 0 ? (
        <p className="text-muted">No games yet. Create your first challenge to get the pod predicting.</p>
      ) : (
      <div className="flex flex-col gap-3">
        {games.map((g) => (
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
      )}
    </div>
  );
}
