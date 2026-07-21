import { describe, it, expect } from 'vitest';
import { gameUpdateFields, type NewGameInput } from './store';

const input: NewGameInput = {
  name: '  Slam  ',
  promotion: '  WWE ',
  eventDate: '2026-08-01',
  lockTime: 1000,
  dayCount: 0,
  matches: [{ id: 'm1', name: 'Main', options: ['A', 'B'] }],
  propBets: [{ id: 'p1', question: 'Run-in?', options: ['Yes', 'No'] }],
  tiebreakerQuestion: '  How long?  ',
};

describe('gameUpdateFields', () => {
  it('writes only editable fields, trimmed', () => {
    expect(gameUpdateFields(input)).toEqual({
      name: 'Slam',
      promotion: 'WWE',
      eventDate: '2026-08-01',
      lockTime: 1000,
      dayCount: 1,
      matches: input.matches,
      propBets: input.propBets,
      tiebreakerQuestion: 'How long?',
    });
  });

  it('never includes identity or lifecycle fields', () => {
    const keys = Object.keys(gameUpdateFields(input));
    for (const forbidden of [
      'status',
      'createdBy',
      'admins',
      'joinCode',
      'createdAt',
      'tiebreakerAnswer',
      'standingsSentFor',
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
