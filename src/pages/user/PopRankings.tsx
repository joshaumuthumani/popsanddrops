import type { Game, LeaderboardEntry, Submission } from '@/types';
import { SectionLabel, StatCard } from '@/components/primitives';
import { PopDropPill, type GradeState } from '@/components/PopDropPill';
import { PopRankingsTable } from '@/components/PopRankingsTable';

interface Props {
  game: Game;
  submission: Submission;
  results: Record<string, string>;
  leaderboard: LeaderboardEntry[];
  meUid: string;
}

function grade(pick: string | undefined, correct: string | undefined): GradeState {
  if (correct === undefined) return 'pending';
  return pick === correct ? 'pop' : 'drop';
}

/** USER · LIVE BOARD — Pop Count / rank / graded stat cards, your picks, live Pop Rankings. */
export function PopRankings({ game, submission, results, leaderboard, meUid }: Props) {
  const totalQuestions = game.matches.length + game.propBets.length;
  const gradedCount = game.matches.filter((m) => results[m.id] !== undefined).length +
    game.propBets.filter((p) => results[p.id] !== undefined).length;

  const myRank = leaderboard.find((e) => e.uid === meUid)?.rank ?? submission.rank;

  return (
    <section>
      {/* stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="POP COUNT" value={submission.popCount} highlight />
        <StatCard label="YOUR RANK" value={myRank} sub={`/${leaderboard.length}`} />
        <StatCard label="GRADED" value={gradedCount} sub={`/${totalQuestions}`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18 }}>
        {/* your picks */}
        <div>
          <SectionLabel style={{ marginBottom: 12 }}>Your picks</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {game.matches.map((m) => {
              const pick = submission.matchPicks[m.id];
              const state = grade(pick, results[m.id]);
              const popped = state === 'pop';
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between"
                  style={{
                    background: popped ? 'rgba(231,201,47,.1)' : 'rgba(255,255,255,.03)',
                    border: `1px solid ${popped ? 'rgba(231,201,47,.3)' : 'rgba(255,255,255,.06)'}`,
                    borderRadius: 12,
                    padding: '13px 15px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: '#6B7A99' }}>{m.name}</div>
                    <div style={{ fontWeight: 800, fontSize: 14.5 }}>{pick ?? '—'}</div>
                  </div>
                  <PopDropPill state={state} />
                </div>
              );
            })}
          </div>
        </div>

        {/* pop rankings */}
        <div>
          <SectionLabel style={{ marginBottom: 12 }}>Pop Rankings</SectionLabel>
          <PopRankingsTable entries={leaderboard} meUid={meUid} showDrops />
        </div>
      </div>
    </section>
  );
}
