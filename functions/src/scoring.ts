// Server-side Pop/Drop scoring + ranking. Mirrors src/lib/scoring.ts on the client —
// keep the two in sync (PRD §4.3, §4.5). Authoritative scores are written back to each
// submission and to the denormalized leaderboard doc by the Cloud Functions.

export interface GameDoc {
  // `day` mirrors Match/PropBet on the client. Type-only: nights are a presentational
  // grouping and never affect scoring, which grades every question regardless of night.
  matches: { id: string; name: string; options: string[]; day?: number }[];
  propBets: { id: string; question: string; options: string[]; day?: number }[];
  tiebreakerQuestion: string;
  tiebreakerAnswer?: string;
  status: string;
}

export interface SubmissionDoc {
  uid: string;
  displayName?: string;
  photoURL?: string | null;
  matchPicks: Record<string, string>;
  propBetPicks: Record<string, string>;
  tiebreakerAnswer: string;
  submittedAt: number;
}

export type Results = Record<string, string>;

export interface LeaderboardRow {
  uid: string;
  displayName: string;
  photoURL: string | null;
  popCount: number;
  dropCount: number;
  tiebreakerAnswer: string;
  rank: number;
}

function questionIds(game: GameDoc): string[] {
  return [...game.matches.map((m) => m.id), ...game.propBets.map((p) => p.id)];
}

export function tally(
  game: GameDoc,
  matchPicks: Record<string, string>,
  propBetPicks: Record<string, string>,
  results: Results,
): { popCount: number; dropCount: number } {
  const picks = { ...matchPicks, ...propBetPicks };
  let popCount = 0;
  let dropCount = 0;
  for (const qid of questionIds(game)) {
    const correct = results[qid];
    if (correct === undefined || correct === '') continue;
    if (picks[qid] === correct) popCount += 1;
    else dropCount += 1;
  }
  return { popCount, dropCount };
}

function isNumeric(s: string): boolean {
  return s.trim() !== '' && !Number.isNaN(Number(s));
}

function tiebreakerCompare(a: string, b: string, correct: string): number {
  if (isNumeric(correct)) {
    const c = Number(correct);
    const da = isNumeric(a) ? Math.abs(Number(a) - c) : Infinity;
    const db = isNumeric(b) ? Math.abs(Number(b) - c) : Infinity;
    return da - db;
  }
  const norm = (x: string) => x.trim().toLowerCase();
  return (norm(a) === norm(correct) ? 0 : 1) - (norm(b) === norm(correct) ? 0 : 1);
}

export function computeLeaderboard(game: GameDoc, subs: SubmissionDoc[], results: Results): LeaderboardRow[] {
  const correctTb = game.tiebreakerAnswer ?? '';
  const useTb = game.status === 'CLOSED' && correctTb.trim() !== '';

  const scored = subs.map((s) => ({
    ...s,
    ...tally(game, s.matchPicks, s.propBetPicks, results),
  }));

  scored.sort((a, b) => {
    if (b.popCount !== a.popCount) return b.popCount - a.popCount;
    if (useTb) {
      const cmp = tiebreakerCompare(a.tiebreakerAnswer, b.tiebreakerAnswer, correctTb);
      if (cmp !== 0) return cmp;
    }
    return a.submittedAt - b.submittedAt;
  });

  const sameRank = (x: (typeof scored)[number], y: (typeof scored)[number]) => {
    if (x.popCount !== y.popCount) return false;
    if (useTb) return tiebreakerCompare(x.tiebreakerAnswer, y.tiebreakerAnswer, correctTb) === 0;
    return true;
  };

  let rank = 0;
  return scored.map((s, i) => {
    if (i === 0 || !sameRank(scored[i - 1], s)) rank = i + 1;
    return {
      uid: s.uid,
      displayName: s.displayName ?? 'Player',
      photoURL: s.photoURL ?? null,
      popCount: s.popCount,
      dropCount: s.dropCount,
      tiebreakerAnswer: s.tiebreakerAnswer,
      rank,
    };
  });
}
