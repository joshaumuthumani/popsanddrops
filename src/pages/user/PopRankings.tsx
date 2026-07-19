import { useMemo } from 'react';
import type { Game, LeaderboardEntry, Submission } from '@/types';
import { NightHeading, SectionLabel, StatCard } from '@/components/primitives';
import { PopDropPill, type GradeState } from '@/components/PopDropPill';
import { PopRankingsTable } from '@/components/PopRankingsTable';
import { tally } from '@/lib/scoring';
import { questionsByDay } from '@/lib/nights';

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

const colHeader = {
  fontSize: 10.5,
  fontWeight: 800,
  letterSpacing: '.14em',
  color: '#77E0E8',
  marginBottom: 10,
} as const;

/** USER · LIVE BOARD — Pop Count / rank / graded stat cards, your picks (matches | props),
 *  live Pop Rankings. Spectators (no submission) still see the board. */
export function PopRankings({ game, submission, results, leaderboard, meUid }: Props) {
  const nights = useMemo(() => questionsByDay(game), [game]);
  const totalQuestions = game.matches.length + game.propBets.length;
  const gradedCount =
    game.matches.filter((m) => results[m.id] !== undefined && results[m.id] !== '').length +
    game.propBets.filter((p) => results[p.id] !== undefined && results[p.id] !== '').length;

  const myTally = submission
    ? tally(game, submission.matchPicks, submission.propBetPicks, results)
    : null;
  const myRank = leaderboard.find((e) => e.uid === meUid)?.rank;

  const pickRow = (id: string, name: string, pick: string | undefined) => {
    const state = grade(pick, results[id]);
    const popped = state === 'pop';
    return (
      <div
        key={id}
        className="flex items-center justify-between"
        style={{
          background: popped ? 'rgba(231,201,47,.1)' : 'rgba(255,255,255,.03)',
          border: `1px solid ${popped ? 'rgba(231,201,47,.3)' : 'rgba(255,255,255,.06)'}`,
          borderRadius: 12,
          padding: '13px 15px',
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: '#6B7A99' }}>{name}</div>
          <div style={{ fontWeight: 800, fontSize: 14.5 }}>{pick ?? '—'}</div>
        </div>
        <PopDropPill state={state} />
      </div>
    );
  };

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

      {submission && (
        <div style={{ marginBottom: 26 }}>
          <SectionLabel style={{ marginBottom: 14 }}>Your picks</SectionLabel>
          {nights.map((night) => (
            <div key={night.day} style={{ marginBottom: nights.length > 1 ? 20 : 0 }}>
              {night.label && <NightHeading label={night.label} style={{ margin: '4px 0 12px' }} />}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18 }}>
                {night.matches.length > 0 && (
                  <div>
                    <div className="uppercase" style={colHeader}>Matches</div>
                    <div className="flex flex-col gap-2.5">
                      {night.matches.map((m) => pickRow(m.id, m.name, submission.matchPicks[m.id]))}
                    </div>
                  </div>
                )}
                {night.propBets.length > 0 && (
                  <div>
                    <div className="uppercase" style={colHeader}>Prop bets</div>
                    <div className="flex flex-col gap-2.5">
                      {night.propBets.map((p) => pickRow(p.id, p.question, submission.propBetPicks[p.id]))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <SectionLabel style={{ marginBottom: 12 }}>Pop Rankings</SectionLabel>
        {leaderboard.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13 }}>
            Rankings unlock when the show starts and picks lock. Check back at bell time.
          </p>
        ) : (
          <PopRankingsTable entries={leaderboard} meUid={meUid} showDrops />
        )}
      </div>
    </section>
  );
}
