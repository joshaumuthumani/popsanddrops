import type { Game, LeaderboardEntry, Submission } from '@/types';
import { SectionLabel, StatCard } from '@/components/primitives';
import { PopDropPill, type GradeState } from '@/components/PopDropPill';
import { PopRankingsTable } from '@/components/PopRankingsTable';
import { tally } from '@/lib/scoring';

interface Props {
  game: Game;
  submission: Submission | null;
  results: Record<string, string>;
  leaderboard: LeaderboardEntry[];
  meUid: string;
}

function grade(pick: string | undefined, correct: string | undefined): GradeState {
  if (correct === undefined || correct === '') return 'pending';
  return pick === correct ? 'pop' : 'drop';
}

/** USER · LIVE BOARD — Pop Count / rank / graded stat cards, your picks, live Pop Rankings.
 *  Spectators (no submission) still see the live board. */
export function PopRankings({ game, submission, results, leaderboard, meUid }: Props) {
  const totalQuestions = game.matches.length + game.propBets.length;
  const gradedCount =
    game.matches.filter((m) => results[m.id] !== undefined && results[m.id] !== '').length +
    game.propBets.filter((p) => results[p.id] !== undefined && results[p.id] !== '').length;

  const myTally = submission
    ? tally(game, submission.matchPicks, submission.propBetPicks, results)
    : null;
  const myRank = leaderboard.find((e) => e.uid === meUid)?.rank;

  // Your picks = matches AND prop bets, in the same order the game lists them.
  const myQuestions = submission
    ? [
        ...game.matches.map((m) => ({ id: m.id, name: m.name, pick: submission.matchPicks[m.id] })),
        ...game.propBets.map((p) => ({ id: p.id, name: p.question, pick: submission.propBetPicks[p.id] })),
      ]
    : [];

  const board =
    leaderboard.length === 0 ? (
      <p className="text-muted" style={{ fontSize: 13 }}>
        Rankings unlock when the show starts and picks lock. Check back at bell time.
      </p>
    ) : (
      <PopRankingsTable entries={leaderboard} meUid={meUid} showDrops />
    );

  return (
    <section>
      {submission ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 24 }}>
          <StatCard label="POP COUNT" value={myTally?.popCount ?? 0} highlight />
          <StatCard label="YOUR RANK" value={myRank ?? '—'} sub={leaderboard.length ? `/${leaderboard.length}` : undefined} />
          <StatCard label="GRADED" value={gradedCount} sub={`/${totalQuestions}`} />
        </div>
      ) : (
        <p className="text-muted" style={{ fontSize: 14, marginBottom: 20, lineHeight: 1.55 }}>
          You're <strong style={{ color: '#77E0E8' }}>spectating</strong> — you didn't lock in picks for this challenge, but here's the live board.
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18 }}>
        {submission && (
          <div>
            <SectionLabel style={{ marginBottom: 12 }}>Your picks</SectionLabel>
            <div className="flex flex-col gap-2.5">
              {myQuestions.map((q) => {
                const state = grade(q.pick, results[q.id]);
                const popped = state === 'pop';
                return (
                  <div
                    key={q.id}
                    className="flex items-center justify-between"
                    style={{
                      background: popped ? 'rgba(231,201,47,.1)' : 'rgba(255,255,255,.03)',
                      border: `1px solid ${popped ? 'rgba(231,201,47,.3)' : 'rgba(255,255,255,.06)'}`,
                      borderRadius: 12,
                      padding: '13px 15px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: '#6B7A99' }}>{q.name}</div>
                      <div style={{ fontWeight: 800, fontSize: 14.5 }}>{q.pick ?? '—'}</div>
                    </div>
                    <PopDropPill state={state} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <SectionLabel style={{ marginBottom: 12 }}>Pop Rankings</SectionLabel>
          {board}
        </div>
      </div>
    </section>
  );
}
