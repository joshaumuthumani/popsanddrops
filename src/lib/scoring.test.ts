import { describe, expect, it } from 'vitest';
import { buildLeaderboard, isNumeric, questionIds, tally, tiebreakerCompare } from '@/lib/scoring';
import { fullResults, makeGame, partialResults, toRankable } from '../../tests/fixtures';

describe('tally', () => {
  const game = makeGame();

  it('counts a Pop per correct pick and a Drop per graded-but-wrong pick', () => {
    const t = tally(game, { m1: 'Roman', m2: 'Iyo', m3: 'Penta' }, { p1: 'Yes' }, fullResults);
    expect(t).toEqual({ popCount: 3, dropCount: 1, gradedCount: 4 });
  });

  it('ignores questions that have not been graded yet', () => {
    // m3 is ungraded in partialResults, so it counts as neither a Pop nor a Drop.
    const t = tally(game, { m1: 'Roman', m2: 'Liv', m3: 'Penta' }, { p1: 'Yes' }, partialResults);
    expect(t).toEqual({ popCount: 3, dropCount: 0, gradedCount: 3 });
  });

  it('treats an empty-string result as ungraded, not as a wrong answer', () => {
    const t = tally(game, { m1: 'Roman' }, {}, { m1: 'Roman', m2: '' });
    expect(t).toEqual({ popCount: 1, dropCount: 0, gradedCount: 1 });
  });

  it('counts a MISSING pick on a graded question as a Drop', () => {
    // Load-bearing, and the reason adding a question after lock is unfair: a player who
    // never had the chance to answer is penalised exactly as if they answered wrongly.
    const t = tally(game, { m1: 'Roman' }, {}, fullResults);
    expect(t).toEqual({ popCount: 1, dropCount: 3, gradedCount: 4 });
  });

  it('lists match ids before prop bet ids', () => {
    expect(questionIds(game)).toEqual(['m1', 'm2', 'm3', 'p1']);
  });
});

describe('isNumeric', () => {
  it.each([
    ['8', true],
    [' 8 ', true],
    ['8.5', true],
    ['0', true],
    ['-3', true],
    ['', false],
    ['   ', false],
    ['eight', false],
    ['8 matches', false],
  ])('isNumeric(%j) === %s', (input, expected) => {
    expect(isNumeric(input)).toBe(expected);
  });
});

describe('tiebreakerCompare', () => {
  it('ranks the closest numeric answer ahead', () => {
    expect(tiebreakerCompare('9', '12', '10')).toBeLessThan(0);
    expect(tiebreakerCompare('12', '9', '10')).toBeGreaterThan(0);
  });

  it('treats equal distance as a tie, over or under', () => {
    expect(tiebreakerCompare('9', '11', '10')).toBe(0);
  });

  it('ranks a non-numeric answer behind any numeric one', () => {
    expect(tiebreakerCompare('lots', '99999', '10')).toBeGreaterThan(0);
  });

  it('matches text answers case- and whitespace-insensitively', () => {
    expect(tiebreakerCompare('  Roman Reigns ', 'Seth', 'roman reigns')).toBeLessThan(0);
  });

  it('treats two wrong text answers as tied', () => {
    expect(tiebreakerCompare('Seth', 'Cody', 'Roman')).toBe(0);
  });
});

describe('buildLeaderboard', () => {
  const game = makeGame();

  it('orders by Pop Count, highest first', () => {
    const board = buildLeaderboard(game, toRankable(), fullResults, false);
    expect(board.map((r) => r.uid)).toEqual(['u1', 'u2', 'u3']);
    expect(board.map((r) => r.popCount)).toEqual([4, 3, 1]);
  });

  it('shares a rank between players on equal Pop Count before close', () => {
    const tied = toRankable().slice(0, 2).map((p) => ({ ...p }));
    tied[1].matchPicks = { ...tied[0].matchPicks };
    const board = buildLeaderboard(game, tied, fullResults, false);
    expect(board.map((r) => r.rank)).toEqual([1, 1]);
  });

  it('resolves a tie by tiebreaker once the game is closed', () => {
    const closed = makeGame({ status: 'CLOSED', tiebreakerAnswer: '10' });
    const tied = toRankable().slice(0, 2).map((p) => ({ ...p }));
    tied[1].matchPicks = { ...tied[0].matchPicks }; // same picks, so same Pop Count
    // u1 answered 8, u2 answered 10. Correct is 10, so u2 should now rank first.
    const board = buildLeaderboard(closed, tied, fullResults, true);
    expect(board.map((r) => r.uid)).toEqual(['u2', 'u1']);
    expect(board.map((r) => r.rank)).toEqual([1, 2]);
  });

  it('falls back to the earliest submission when the tiebreaker also ties', () => {
    const closed = makeGame({ status: 'CLOSED', tiebreakerAnswer: '10' });
    const a = { ...toRankable()[0], uid: 'early', tiebreakerAnswer: '10', submittedAt: 1 };
    const b = { ...toRankable()[0], uid: 'late', tiebreakerAnswer: '10', submittedAt: 999 };
    const board = buildLeaderboard(closed, [b, a], fullResults, true);
    expect(board.map((r) => r.uid)).toEqual(['early', 'late']);
  });

  it('does not apply the tiebreaker when no correct answer has been entered', () => {
    const closed = makeGame({ status: 'CLOSED', tiebreakerAnswer: '   ' });
    const tied = toRankable().slice(0, 2).map((p) => ({ ...p }));
    tied[1].matchPicks = { ...tied[0].matchPicks };
    const board = buildLeaderboard(closed, tied, fullResults, true);
    expect(board.map((r) => r.rank)).toEqual([1, 1]);
  });

  it('returns an empty board for no submissions', () => {
    expect(buildLeaderboard(game, [], fullResults, false)).toEqual([]);
  });
});
