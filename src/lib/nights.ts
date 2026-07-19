// Night grouping for multi-night cards (SummerSlam, WrestleMania).
//
// A multi-night event is ONE game played over several nights — one submission, one lock
// before night 1, one leaderboard. Nights are a presentational grouping only, never a
// scoring or access-control boundary. See
// docs/superpowers/specs/2026-07-19-multi-night-events-design.md.
//
// Deliberately NOT in scoring.ts: that file and functions/src/scoring.ts must stay exact
// mirrors because a divergence there produces wrong Pop Counts. This is presentation, whose
// worst failure is an odd heading — no reason to expand that high-stakes mirror surface.

import type { Game, Match, PropBet } from '@/types';

export interface NightGroup {
  /** 1-based night number. */
  day: number;
  /** Heading shown above the group, e.g. "NIGHT 1". Empty for single-night games. */
  label: string;
  matches: Match[];
  propBets: PropBet[];
}

/** How many nights a game runs, tolerating older documents with no `dayCount`. */
export function nightCount(game: Pick<Game, 'dayCount'>): number {
  const n = Number(game.dayCount ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** True when a game runs across more than one night. */
export function isMultiNight(game: Pick<Game, 'dayCount'>): boolean {
  return nightCount(game) > 1;
}

/**
 * The night a question belongs to. Anything missing, out of range, or unparseable falls
 * back to night 1 so a bad value can never hide a question from the picks screen.
 */
export function nightOf(question: { day?: number }, total: number): number {
  const d = Number(question.day ?? 1);
  if (!Number.isFinite(d)) return 1;
  return Math.min(Math.max(Math.floor(d), 1), total);
}

/**
 * Groups a game's questions by night, in night order.
 *
 * Single-night games return exactly one group with an empty label, so callers can render
 * one code path for both cases and get today's ungrouped output for free.
 */
export function questionsByDay(game: Game): NightGroup[] {
  const total = nightCount(game);
  const groups: NightGroup[] = Array.from({ length: total }, (_, i) => ({
    day: i + 1,
    label: total > 1 ? `NIGHT ${i + 1}` : '',
    matches: [],
    propBets: [],
  }));

  for (const m of game.matches) groups[nightOf(m, total) - 1].matches.push(m);
  for (const p of game.propBets) groups[nightOf(p, total) - 1].propBets.push(p);

  // Drop empty nights so an admin who set 3 and only filled 2 doesn't get a stray heading.
  return groups.filter((g) => g.matches.length > 0 || g.propBets.length > 0);
}

/** Every question id for one night — used to tell whether that night is fully graded. */
export function questionIdsForNight(game: Game, day: number): string[] {
  const total = nightCount(game);
  return [
    ...game.matches.filter((m) => nightOf(m, total) === day).map((m) => m.id),
    ...game.propBets.filter((p) => nightOf(p, total) === day).map((p) => p.id),
  ];
}
