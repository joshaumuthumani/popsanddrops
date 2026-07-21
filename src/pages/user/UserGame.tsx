import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Eyebrow, PageTitle } from '@/components/primitives';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { MakePicks } from '@/pages/user/MakePicks';
import { PopRankings } from '@/pages/user/PopRankings';
import { useAuth } from '@/context/AuthContext';
import { useGame, useMySubmission, useResults, useLeaderboard, isLocked } from '@/hooks/data';
import { saveSubmission, type SubmissionInput } from '@/lib/store';
import { isFirebaseConfigured } from '@/lib/firebase';
import { gameQuestions, orphanedPickIds, submissionPicks, unansweredQuestionIds } from '@/lib/pickIntegrity';

type Screen = 'predict' | 'live';

/** Wraps the two user screens for a single game with the pill tab switcher. */
export function UserGame() {
  const { gameId } = useParams();
  const { user } = useAuth();
  const { game, loading } = useGame(gameId);
  const { submission, loading: submissionLoading } = useMySubmission(gameId, user?.uid);
  const results = useResults(gameId);
  const leaderboard = useLeaderboard(game, user);
  // ?view=rankings deep-links straight to the board. Result emails link here promising
  // "View the full Pop Rankings", and without this they land on Make Picks instead.
  const [searchParams] = useSearchParams();
  const wantsRankings = searchParams.get('view') === 'rankings';
  const [screen, setScreen] = useState<Screen>(wantsRankings ? 'live' : 'predict');
  const [saving, setSaving] = useState(false);

  const locked = game ? isLocked(game) : false;

  // Questions a super-admin edit has left needing the player's attention: a saved pick whose
  // option was renamed/removed, or a question added after they locked in. Only meaningful once
  // they've submitted — a player who never picked isn't "changed", just new. Derived from
  // current state, so no edit history is stored.
  const needsAttention =
    game && submission
      ? [
          ...orphanedPickIds(gameQuestions(game), submissionPicks(submission)),
          ...unansweredQuestionIds(gameQuestions(game), submissionPicks(submission)),
        ]
      : [];

  // Once locked there's nothing to submit — land on the live board.
  useEffect(() => {
    if (locked) setScreen('live');
  }, [locked]);

  // Wait for the submission too. MakePicks seeds its state from these props with useState,
  // which only reads them on mount — rendering before the subscription resolves meant it
  // initialised empty and then ignored the picks when they arrived, so a player who had
  // already submitted was shown a blank pick sheet and told "0 of N locked in".
  if (loading || submissionLoading) return <p className="text-muted">Loading…</p>;
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
          needsAttention={needsAttention}
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
