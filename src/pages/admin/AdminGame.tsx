import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Eyebrow, PageTitle } from '@/components/primitives';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { AdminDashboardPanel } from '@/pages/admin/AdminDashboardPanel';
import { LiveControlPanel } from '@/pages/admin/LiveControlPanel';
import { PlayersPanel } from '@/pages/admin/PlayersPanel';
import { DeleteGameDialog } from '@/components/DeleteGameDialog';
import { useGame } from '@/hooks/data';
import { useAuth } from '@/context/AuthContext';
import { subscribeSubmissions } from '@/lib/store';
import { isFirebaseConfigured } from '@/lib/firebase';

type Screen = 'dash' | 'live' | 'players';

/** Admin console for one game: Dashboard | Live control | Players tabs (matches the design). */
export function AdminGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { game, loading } = useGame(gameId);
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>('dash');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);

  // Live submission count, purely to tell the delete dialog how much it's about to destroy.
  // Guarded on isFirebaseConfigured: subscribeSubmissions calls reqDb(), which throws in demo
  // mode — an unguarded call would crash the whole console instead of degrading quietly.
  useEffect(() => {
    if (!gameId || !isFirebaseConfigured) return;
    return subscribeSubmissions(gameId, (subs) => setPlayerCount(subs.length));
  }, [gameId]);

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!game) return <p className="text-muted">That game doesn't exist or you don't have access to it.</p>;

  const closed = game.status === 'CLOSED';
  const isSuperAdmin = user?.role === 'superadmin';

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap" style={{ marginBottom: 22 }}>
        <div>
          <Link to="/admin" className="no-underline">
            <Eyebrow>← All challenges</Eyebrow>
          </Link>
          <PageTitle>{game.name}</PageTitle>
          {/* Editing a live game is a Super-Admin action (rules enforce it too); hidden once
              the game is closed and frozen. */}
          {isSuperAdmin && (
            <div className="flex items-center gap-4" style={{ marginTop: 6 }}>
              {!closed && (
                <Link to={`/admin/game/${game.id}/edit`} className="no-underline">
                  <span style={{ color: '#77E0E8', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                    Edit game →
                  </span>
                </Link>
              )}
              {/* Delete works on any status (cleanup); the dialog's type-to-confirm is the guard. */}
              <button
                onClick={() => setConfirmDelete(true)}
                className="cursor-pointer bg-transparent"
                style={{ border: 'none', padding: 0, color: '#C0392B', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}
              >
                Delete game
              </button>
            </div>
          )}
        </div>
        <SegmentedTabs<Screen>
          tabs={[
            { value: 'dash', label: 'Dashboard' },
            { value: 'live', label: closed ? 'Results' : 'Live control' },
            { value: 'players', label: 'Players' },
          ]}
          value={screen}
          onChange={setScreen}
        />
      </div>

      {screen === 'dash' && <AdminDashboardPanel game={game} onEnterLive={() => setScreen('live')} />}
      {screen === 'live' && <LiveControlPanel game={game} readOnly={closed} />}
      {screen === 'players' && <PlayersPanel game={game} />}

      {confirmDelete && (
        <DeleteGameDialog
          game={game}
          playerCount={playerCount}
          onClose={() => setConfirmDelete(false)}
          onDeleted={() => navigate('/admin')}
        />
      )}
    </div>
  );
}
