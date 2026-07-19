import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Eyebrow, PageTitle } from '@/components/primitives';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { MakePicks } from '@/pages/user/MakePicks';
import { PopRankings } from '@/pages/user/PopRankings';
import { useAuth } from '@/context/AuthContext';
import { useGame, useMySubmission, useResults, useLeaderboard, isLocked } from '@/hooks/data';
import { saveSubmission, type SubmissionInput } from '@/lib/store';
import { isFirebaseConfigured } from '@/lib/firebase';

type Screen = 'predict' | 'live';

/** Wraps the two user screens for a single game with the pill tab switcher. */
export function UserGame() {
  const { gameId } = useParams();
  const { user } = useAuth();
  const { game, loading } = useGame(gameId);
  const { submission } = useMySubmission(gameId, user?.uid);
  const results = useResults(gameId);
  const leaderboard = useLeaderboard(game, user);
  const [screen, setScreen] = useState<Screen>('predict');
  const [saving, setSaving] = useState(false);

  const locked = game ? isLocked(game) : false;

  // Once locked there's nothing to submit — land on the live board.
  useEffect(() => {
    if (locked) setScreen('live');
  }, [locked]);

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!game) return <p className="text-muted">That game doesn't exist or the code was wrong.</p>;

  // Deliberately does NOT swallow errors: MakePicks awaits this and only confirms on
  // success, so a rejection here is what surfaces the failure to the player.
  const handleSubmit = async (picks: SubmissionInput) => {
    if (!isFirebaseConfigured || !user) return;
    setSaving(true);
    try {
      await saveSubmission(game.id, user, picks);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap" style={{ marginBottom: 22 }}>
        <div>
          <Link to="/app" className="no-underline">
            <Eyebrow>← Your challenges</Eyebrow>
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
          initialMatchPicks={submission?.matchPicks ?? {}}
          initialPropPicks={submission?.propBetPicks ?? {}}
          initialTiebreaker={submission?.tiebreakerAnswer ?? ''}
          locked={locked}
          saving={saving}
          onSubmit={handleSubmit}
        />
      ) : (
        <PopRankings
          game={game}
          submission={submission}
          results={results}
          leaderboard={leaderboard}
          meUid={user?.uid ?? ''}
        />
      )}
    </div>
  );
}
