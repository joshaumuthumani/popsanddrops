// deleteGame — Super-Admin-only hard delete of a game and ALL its subcollections.
//
// Must be a callable using the Admin SDK: the client cannot delete `submissions`
// (allow delete: if false) or `leaderboard` (write: if false), so a client-side delete would
// half-succeed. recursiveDelete removes the game doc + every subcollection (submissions,
// results, leaderboard, meta, emailLog) and bypasses these rules. It does NOT emit per-doc
// delete events, so onResultWrite / onGameClose do not fire during a delete.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';

export const deleteGame = onCall<{ gameId?: string }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const db = getFirestore();
  const role = (await db.doc(`users/${uid}`).get()).data()?.role;
  if (role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Only a Super Admin can delete a game.');
  }

  const gameId = request.data?.gameId;
  // Reject a '/' so a multi-segment id can't retarget a sub-path (defense in depth — only a
  // super admin reaches here, but keep the target a single top-level game doc).
  if (typeof gameId !== 'string' || !gameId || gameId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Which game?');
  }
  if (!(await db.doc(`games/${gameId}`).get()).exists) {
    throw new HttpsError('not-found', 'That game no longer exists.');
  }

  try {
    await db.recursiveDelete(db.doc(`games/${gameId}`));
  } catch (err) {
    // recursiveDelete runs a BulkWriter over the whole subtree; a mid-way failure can leave
    // some docs behind. Log with context and report honestly. recursiveDelete is idempotent,
    // so a retry re-drives the delete over whatever remains (the game doc is still present).
    logger.error(`deleteGame failed for game ${gameId}`, err);
    throw new HttpsError('internal', "Delete didn't finish — some data may remain. Please try again.");
  }
  return { deleted: true };
});
