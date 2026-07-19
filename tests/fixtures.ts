import type { Game } from '@/types';
import type { GameDoc, SubmissionDoc } from '../functions/src/scoring';

/**
 * Shared fixtures for the scoring tests, including the mirror test that runs both
 * implementations over the same data. Kept in one place so the two sides can never
 * accidentally be tested against different inputs — which would defeat the point.
 */

export function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    name: 'SummerSlam',
    promotion: 'WWE',
    eventDate: '2026-08-01',
    lockTime: 1785600000000,
    dayCount: 1,
    status: 'OPEN',
    matches: [
      { id: 'm1', name: 'World Title', options: ['Roman', 'Seth'] },
      { id: 'm2', name: 'Womens Title', options: ['Liv', 'Iyo'] },
      { id: 'm3', name: 'IC Title', options: ['Penta', 'Gable'] },
    ],
    propBets: [{ id: 'p1', question: 'Interference?', options: ['Yes', 'No'] }],
    tiebreakerQuestion: 'Total matches',
    joinCode: 'SLAM-1234',
    admins: [],
    createdBy: 'admin1',
    createdAt: 0,
    ...overrides,
  };
}

/** The same game as the server sees it. Only the fields the server actually reads. */
export function toGameDoc(game: Game): GameDoc {
  return {
    matches: game.matches,
    propBets: game.propBets,
    tiebreakerQuestion: game.tiebreakerQuestion,
    tiebreakerAnswer: game.tiebreakerAnswer,
    status: game.status,
  };
}

export interface Player {
  uid: string;
  displayName: string;
  matchPicks: Record<string, string>;
  propBetPicks: Record<string, string>;
  tiebreakerAnswer: string;
  submittedAt: number;
}

export const players: Player[] = [
  {
    uid: 'u1',
    displayName: 'Ada Lovelace',
    matchPicks: { m1: 'Roman', m2: 'Liv', m3: 'Penta' },
    propBetPicks: { p1: 'Yes' },
    tiebreakerAnswer: '8',
    submittedAt: 100,
  },
  {
    uid: 'u2',
    displayName: 'Grace Hopper',
    matchPicks: { m1: 'Roman', m2: 'Iyo', m3: 'Penta' },
    propBetPicks: { p1: 'Yes' },
    tiebreakerAnswer: '10',
    submittedAt: 200,
  },
  {
    uid: 'u3',
    displayName: 'Alan Turing',
    // Deliberately incomplete: m3 was never answered. A missing pick on a graded question
    // is a Drop, not a skip — the behaviour that makes adding a question after lock unfair.
    matchPicks: { m1: 'Seth', m2: 'Liv' },
    propBetPicks: { p1: 'No' },
    tiebreakerAnswer: '9',
    submittedAt: 50,
  },
];

export function toSubmissionDocs(list: Player[] = players): SubmissionDoc[] {
  return list.map((p) => ({
    uid: p.uid,
    displayName: p.displayName,
    photoURL: null,
    matchPicks: p.matchPicks,
    propBetPicks: p.propBetPicks,
    tiebreakerAnswer: p.tiebreakerAnswer,
    submittedAt: p.submittedAt,
  }));
}

export function toRankable(list: Player[] = players) {
  return list.map((p) => ({
    uid: p.uid,
    displayName: p.displayName,
    photoURL: null,
    matchPicks: p.matchPicks,
    propBetPicks: p.propBetPicks,
    tiebreakerAnswer: p.tiebreakerAnswer,
    submittedAt: p.submittedAt,
  }));
}

/** m3 intentionally left ungraded so "graded so far" behaviour is covered. */
export const partialResults = { m1: 'Roman', m2: 'Liv', p1: 'Yes' };
export const fullResults = { m1: 'Roman', m2: 'Liv', m3: 'Penta', p1: 'Yes' };
