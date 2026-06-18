import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Eyebrow, PageTitle } from '@/components/primitives';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { AdminDashboardPanel } from '@/pages/admin/AdminDashboardPanel';
import { LiveControlPanel } from '@/pages/admin/LiveControlPanel';
import { MOCK_GAMES } from '@/data/mock';

type Screen = 'dash' | 'live';

/** Admin console for one game: Dashboard | Live control tabs (matches the design). */
export function AdminGame() {
  const { gameId } = useParams();
  const game = MOCK_GAMES.find((g) => g.id === gameId) ?? MOCK_GAMES[0];
  const [screen, setScreen] = useState<Screen>('dash');

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
            { value: 'live', label: 'Live control' },
          ]}
          value={screen}
          onChange={setScreen}
        />
      </div>

      {screen === 'dash' ? (
        <AdminDashboardPanel game={game} onEnterLive={() => setScreen('live')} />
      ) : (
        <LiveControlPanel game={game} />
      )}
    </div>
  );
}
