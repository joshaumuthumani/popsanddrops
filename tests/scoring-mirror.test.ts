import { describe, expect, it } from 'vitest';
import { tally as clientTally, buildLeaderboard } from '@/lib/scoring';
import { tally as serverTally, computeLeaderboard } from '../functions/src/scoring';
import {
  fullResults,
  makeGame,
  partialResults,
  players,
  toGameDoc,
  toRankable,
  toSubmissionDocs,
} from './fixtures';

/**
 * CLAUDE.md: "src/lib/scoring.ts and functions/src/scoring.ts are mirrors. Change one,
 * change the other." Until now that was a rule someone had to remember. These tests make
 * the build enforce it: both implementations run over identical fixtures and must agree.
 *
 * A divergence here means players see one Pop Count in the app and a different one in the
 * leaderboard the server writes — the worst class of bug this project can ship, because
 * nothing about it looks broken.
 */
describe('scoring mirror: client and server agree', () => {
  const game = makeGame();
  const doc = toGameDoc(game);

  it.each([
    ['partially graded', partialResults],
    ['fully graded', fullResults],
  ])('tally matches for every player when %s', (_label, results) => {
    for (const p of players) {
      const client = clientTally(game, p.matchPicks, p.propBetPicks, results);
      const server = serverTally(doc, p.matchPicks, p.propBetPicks, results);

      expect(server.popCount, `popCount for ${p.uid}`).toBe(client.popCount);
      expect(server.dropCount, `dropCount for ${p.uid}`).toBe(client.dropCount);
    }
  });

  it('ranks players identically before the tiebreaker applies', () => {
    // Client: applyTiebreaker=false. Server: status !== CLOSED. Same condition, expressed
    // differently on each side — which is exactly the kind of drift worth pinning down.
    const client = buildLeaderboard(game, toRankable(), fullResults, false);
    const server = computeLeaderboard(doc, toSubmissionDocs(), fullResults);

    expect(server.map((r) => [r.uid, r.popCount, r.rank])).toEqual(
      client.map((r) => [r.uid, r.popCount, r.rank]),
    );
  });

  it('ranks players identically once closed and the tiebreaker resolves ties', () => {
    const closed = makeGame({ status: 'CLOSED', tiebreakerAnswer: '9' });
    const closedDoc = toGameDoc(closed);

    const client = buildLeaderboard(closed, toRankable(), fullResults, true);
    const server = computeLeaderboard(closedDoc, toSubmissionDocs(), fullResults);

    expect(server.map((r) => [r.uid, r.popCount, r.rank])).toEqual(
      client.map((r) => [r.uid, r.popCount, r.rank]),
    );
  });

  it('agrees when nobody has submitted', () => {
    const client = buildLeaderboard(game, [], fullResults, false);
    const server = computeLeaderboard(doc, [], fullResults);

    expect(client).toEqual([]);
    expect(server).toEqual([]);
  });

  it('agrees on a multi-night card, where night grouping must not affect scoring', () => {
    // Nights are presentational. If a `day` field ever started influencing the tally, this
    // is where it would show up.
    const multi = makeGame({
      dayCount: 2,
      matches: [
        { id: 'm1', name: 'World Title', options: ['Roman', 'Seth'], day: 1 },
        { id: 'm2', name: 'Womens Title', options: ['Liv', 'Iyo'], day: 2 },
        { id: 'm3', name: 'IC Title', options: ['Penta', 'Gable'], day: 2 },
      ],
    });

    for (const p of players) {
      const client = clientTally(multi, p.matchPicks, p.propBetPicks, fullResults);
      const server = serverTally(toGameDoc(multi), p.matchPicks, p.propBetPicks, fullResults);
      expect(server).toMatchObject({ popCount: client.popCount, dropCount: client.dropCount });
    }
  });
});
