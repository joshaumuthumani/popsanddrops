import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Eyebrow, PageTitle } from '@/components/primitives';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { AdminDashboardPanel } from '@/pages/admin/AdminDashboardPanel';
import { LiveControlPanel } from '@/pages/admin/LiveControlPanel';
import { PlayersPanel } from '@/pages/admin/PlayersPanel';
import { useGame } from '@/hooks/data';

type Screen = 'dash' | 'live' | 'players';

/** Admin console for one game: Dashboard | Live control | Players tabs (matches the design). */
export function AdminGame() {
  const { gameId } = useParams();
  const { game, loading } = useGame(gameId);
  const [screen, setScreen] = useState<Screen>('dash');

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!game) return <p className="text-muted">That game doesn't exist or you don't have access to it.</p>;

  const closed = game.status === 'CLOSED';

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap" style={{ marginBottom: 22 }}>
        <div>
          <Link to="/admin" className="no-underline">
            <Eyebrow>Admin console · Organizer</Eyebrow>
          </Link>
          <PageTitle>{game.name}</PageTitle>
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
    </div>
  );
}
