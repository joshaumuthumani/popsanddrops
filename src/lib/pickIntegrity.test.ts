import { describe, it, expect } from 'vitest';
import {
  gameQuestions,
  orphanedPickIds,
  unansweredQuestionIds,
  orphanImpact,
  submissionPicks,
} from './pickIntegrity';

const questions = [
  { id: 'm1', options: ['Roman', 'Seth'] },
  { id: 'p1', options: ['Yes', 'No'] },
];

describe('orphanedPickIds', () => {
  it('flags a pick whose option was removed/renamed', () => {
    expect(orphanedPickIds(questions, { m1: 'Cody' })).toEqual(['m1']);
  });
  it('flags a pick for a question that no longer exists', () => {
    expect(orphanedPickIds(questions, { gone: 'Roman' })).toEqual(['gone']);
  });
  it('ignores valid picks and empty picks', () => {
    expect(orphanedPickIds(questions, { m1: 'Roman', p1: '' })).toEqual([]);
  });
});

describe('unansweredQuestionIds', () => {
  it('lists questions with no non-empty pick', () => {
    expect(unansweredQuestionIds(questions, { m1: 'Roman' }).sort()).toEqual(['p1']);
  });
});

describe('orphanImpact', () => {
  it('counts affected submissions and per-option tallies', () => {
    const subs = [
      { matchPicks: { m1: 'Cody' }, propBetPicks: {} },
      { matchPicks: { m1: 'Cody' }, propBetPicks: {} },
      { matchPicks: { m1: 'Roman' }, propBetPicks: {} },
    ];
    const impact = orphanImpact(questions, subs);
    expect(impact.totalAffected).toBe(2);
    expect(impact.byOption).toEqual([{ questionId: 'm1', option: 'Cody', count: 2 }]);
  });
  it('preserves multi-word option text in the tally', () => {
    const q = [{ id: 'm1', options: ['Seth Rollins'] }];
    const subs = [{ matchPicks: { m1: 'Roman Reigns' }, propBetPicks: {} }];
    expect(orphanImpact(q, subs).byOption).toEqual([{ questionId: 'm1', option: 'Roman Reigns', count: 1 }]);
  });
  it('is empty when nothing is orphaned', () => {
    const impact = orphanImpact(questions, [{ matchPicks: { m1: 'Roman' }, propBetPicks: { p1: 'No' } }]);
    expect(impact.totalAffected).toBe(0);
    expect(impact.byOption).toEqual([]);
  });
});

describe('gameQuestions / submissionPicks', () => {
  it('flattens matches+props and merges pick maps', () => {
    const game = {
      matches: [{ id: 'm1', name: 'A', options: ['Roman', 'Seth'] }],
      propBets: [{ id: 'p1', question: 'Q', options: ['Yes', 'No'] }],
    };
    expect(gameQuestions(game as never)).toEqual(questions);
    expect(submissionPicks({ matchPicks: { m1: 'Roman' }, propBetPicks: { p1: 'No' } })).toEqual({
      m1: 'Roman',
      p1: 'No',
    });
  });
});
