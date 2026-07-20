import { describe, expect, it } from 'vitest';
import { isMultiNight, nightCount, nightOf, questionIdsForNight, questionsByDay } from '@/lib/nights';
import { makeGame } from '../../tests/fixtures';

describe('nightCount', () => {
  it('defaults to 1 for a game with no dayCount', () => {
    expect(nightCount({ dayCount: undefined as unknown as number })).toBe(1);
  });

  it.each([
    [1, 1],
    [2, 2],
    [6, 6],
  ])('reads dayCount %i as %i nights', (input, expected) => {
    expect(nightCount({ dayCount: input })).toBe(expected);
  });

  it('falls back to 1 rather than trusting a nonsense value', () => {
    expect(nightCount({ dayCount: 0 })).toBe(1);
    expect(nightCount({ dayCount: -3 })).toBe(1);
    expect(nightCount({ dayCount: NaN })).toBe(1);
  });
});

describe('isMultiNight', () => {
  it('is false for a single night and true beyond that', () => {
    expect(isMultiNight({ dayCount: 1 })).toBe(false);
    expect(isMultiNight({ dayCount: 2 })).toBe(true);
  });
});

describe('nightOf', () => {
  it('defaults a question with no day to night 1', () => {
    expect(nightOf({}, 3)).toBe(1);
  });

  it('clamps a day beyond the last night rather than hiding the question', () => {
    // A question that vanished from the picks screen would be far worse than one on the
    // wrong night, so out-of-range clamps instead of filtering.
    expect(nightOf({ day: 9 }, 2)).toBe(2);
    expect(nightOf({ day: 0 }, 2)).toBe(1);
  });

  it('falls back to night 1 for an unparseable day', () => {
    expect(nightOf({ day: NaN }, 2)).toBe(1);
  });
});

describe('questionsByDay', () => {
  it('returns exactly one unlabelled group for a single-night game', () => {
    const groups = questionsByDay(makeGame());
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('');
    expect(groups[0].matches.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(groups[0].propBets.map((p) => p.id)).toEqual(['p1']);
  });

  it('splits questions across nights and labels them', () => {
    const game = makeGame({
      dayCount: 2,
      matches: [
        { id: 'm1', name: 'A', options: ['x', 'y'], day: 1 },
        { id: 'm2', name: 'B', options: ['x', 'y'], day: 2 },
      ],
      propBets: [{ id: 'p1', question: 'C', options: ['Yes', 'No'], day: 2 }],
    });
    const groups = questionsByDay(game);

    expect(groups.map((g) => g.label)).toEqual(['NIGHT 1', 'NIGHT 2']);
    expect(groups[0].matches.map((m) => m.id)).toEqual(['m1']);
    expect(groups[1].matches.map((m) => m.id)).toEqual(['m2']);
    expect(groups[1].propBets.map((p) => p.id)).toEqual(['p1']);
  });

  it('drops empty nights so a stray heading never appears', () => {
    // Admin set 3 nights but only filled two of them.
    const game = makeGame({
      dayCount: 3,
      matches: [
        { id: 'm1', name: 'A', options: ['x', 'y'], day: 1 },
        { id: 'm2', name: 'B', options: ['x', 'y'], day: 3 },
      ],
      propBets: [],
    });
    const groups = questionsByDay(game);
    expect(groups.map((g) => g.day)).toEqual([1, 3]);
  });

  it('never loses a question, whatever the day values are', () => {
    const game = makeGame({
      dayCount: 2,
      matches: [
        { id: 'm1', name: 'A', options: ['x', 'y'] }, // no day
        { id: 'm2', name: 'B', options: ['x', 'y'], day: 99 }, // out of range
        { id: 'm3', name: 'C', options: ['x', 'y'], day: 2 },
      ],
      propBets: [{ id: 'p1', question: 'D', options: ['Yes', 'No'], day: 0 }],
    });
    const seen = questionsByDay(game).flatMap((g) => [
      ...g.matches.map((m) => m.id),
      ...g.propBets.map((p) => p.id),
    ]);
    expect(seen.sort()).toEqual(['m1', 'm2', 'm3', 'p1']);
  });
});

describe('questionIdsForNight', () => {
  const game = makeGame({
    dayCount: 2,
    matches: [
      { id: 'm1', name: 'A', options: ['x', 'y'], day: 1 },
      { id: 'm2', name: 'B', options: ['x', 'y'], day: 2 },
    ],
    propBets: [{ id: 'p1', question: 'C', options: ['Yes', 'No'], day: 1 }],
  });

  it('returns only that night, matches before props', () => {
    expect(questionIdsForNight(game, 1)).toEqual(['m1', 'p1']);
    expect(questionIdsForNight(game, 2)).toEqual(['m2']);
  });

  it('returns nothing for a night with no questions', () => {
    expect(questionIdsForNight(game, 5)).toEqual([]);
  });
});
