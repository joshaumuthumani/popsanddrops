// Pure Pop/Drop scoring + ranking. No Firebase here so it's trivially testable and
// mirrors the server-side logic in functions/ (PRD §4.3, §4.5). UI copy uses Pop/Drop;
// "score" === popCount internally.

import type { Game, LeaderboardEntry, Results } from '@/types';
import { initialsFromName } from '@/lib/format';

/** Every gradeable question id in a game (matches first, then prop bets). */
export function questionIds(game: Game): string[] {
  return [...game.matches.map((m) => m.id), ...game.propBets.map((p) => p.id)];
}

export interface Tally {
  popCount: number;
  dropCount: number;
  gradedCount: number;
}

/** Binary scoring: 1 Pop per correct answer, 1 Drop per graded-but-wrong (PRD §4.5). */
export function tally(
  game: Game,
  matchPicks: Record<string, string>,
  propBetPicks: Record<string, string>,
  results: Results,
): Tally {
  const picks = { ...matchPicks, ...propBetPicks };
  let popCount = 0;
  let dropCount = 0;
  let gradedCount = 0;
  for (const qid of questionIds(game)) {
    const correct = results[qid];
    if (correct === undefined || correct === '') continue; // not yet graded
    gradedCount += 1;
    if (picks[qid] === correct) popCount += 1;
    else dropCount += 1;
  }
  return { popCount, dropCount, gradedCount };
}

export function isNumeric(s: string): boolean {
  return s.trim() !== '' && !Number.isNaN(Number(s));
}

/**
 * Tiebreaker ordering (PRD §4.3). Returns <0 if `a` should rank ahead of `b`.
 * Numeric correct answer → closest value wins. Text → exact case-insensitive match wins.
 */
export function tiebreakerCompare(a: string, b: string, correct: string): number {
  if (isNumeric(correct)) {
    const c = Number(correct);
    const da = isNumeric(a) ? Math.abs(Number(a) - c) : Infinity;
    const db = isNumeric(b) ? Math.abs(Number(b) - c) : Infinity;
    return da - db;
  }
  const norm = (x: string) => x.trim().toLowerCase();
  const am = norm(a) === norm(correct) ? 0 : 1;
  const bm = norm(b) === norm(correct) ? 0 : 1;
  return am - bm;
}

export interface RankableSubmission {
  uid: string;
  displayName: string;
  photoURL: string | null;
  matchPicks: Record<string, string>;
  propBetPicks: Record<string, string>;
  tiebreakerAnswer: string;
  submittedAt: number;
}

/**
 * Builds the ranked board. Ties share a rank by Pop Count until close; once the game is
 * CLOSED the admin's tiebreaker answer (then earliest submission) resolves them (PRD §4.5).
 */
export function buildLeaderboard(
  game: Game,
  subs: RankableSubmission[],
  results: Results,
  applyTiebreaker: boolean,
): LeaderboardEntry[] {
  const correctTb = game.tiebreakerAnswer ?? '';
  const useTb = applyTiebreaker && correctTb.trim() !== '';

  const scored = subs.map((s) => {
    const t = tally(game, s.matchPicks, s.propBetPicks, results);
    return { ...s, popCount: t.popCount, dropCount: t.dropCount };
  });

  scored.sort((a, b) => {
    if (b.popCount !== a.popCount) return b.popCount - a.popCount;
    if (useTb) {
      const cmp = tiebreakerCompare(a.tiebreakerAnswer, b.tiebreakerAnswer, correctTb);
      if (cmp !== 0) return cmp;
    }
    return a.submittedAt - b.submittedAt; // earliest submission breaks remaining ties
  });

  // Two players share a rank only when they're genuinely indistinguishable for the
  // current phase: same Pop Count pre-close; same Pop Count + tiebreaker standing post-close.
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
      displayName: s.displayName,
      photoURL: s.photoURL,
      initials: initialsFromName(s.displayName),
      popCount: s.popCount,
      dropCount: s.dropCount,
      tiebreakerAnswer: s.tiebreakerAnswer,
      rank,
    };
  });
}
