import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Eyebrow, PageTitle } from '@/components/primitives';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { MakePicks } from '@/pages/user/MakePicks';
import { PopRankings } from '@/pages/user/PopRankings';
import { MOCK_GAMES, MOCK_MY_SUBMISSION, MOCK_RESULTS, MOCK_LEADERBOARD, MOCK_CURRENT_USER } from '@/data/mock';

type Screen = 'predict' | 'live';

/** Wraps the two user screens for a single game with the pill tab switcher. */
export function UserGame() {
  const { gameId } = useParams();
  const game = MOCK_GAMES.find((g) => g.id === gameId) ?? MOCK_GAMES[0];
  const [screen, setScreen] = useState<Screen>('predict');

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap" style={{ marginBottom: 22 }}>
        <div>
          <Link to="/app" className="no-underline">
            <Eyebrow>User app · Participant</Eyebrow>
          </Link>
          <PageTitle>{game.name}</PageTitle>
        </div>
        <SegmentedTabs<Screen>
          tabs={[
            { value: 'predict', label: 'Make Picks' },
            { value: 'live', label: 'Pop Rankings' },
          ]}
          value={screen}
          onChange={setScreen}
        />
      </div>

      {screen === 'predict' ? (
        <MakePicks
          game={game}
          initialMatchPicks={MOCK_MY_SUBMISSION.matchPicks}
          initialTiebreaker={MOCK_MY_SUBMISSION.tiebreakerAnswer}
        />
      ) : (
        <PopRankings
          game={game}
          submission={MOCK_MY_SUBMISSION}
          results={MOCK_RESULTS}
          leaderboard={MOCK_LEADERBOARD}
          meUid={MOCK_CURRENT_USER.uid}
        />
      )}
    </div>
  );
}
