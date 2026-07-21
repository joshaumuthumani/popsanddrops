// deleteGame — Super-Admin-only hard delete of a game and ALL its subcollections.
//
// Must be a callable using the Admin SDK: the client cannot delete `submissions`
// (allow delete: if false) or `leaderboard` (write: if false), so a client-side delete would
// half-succeed. recursiveDelete removes the game doc + every subcollection (submissions,
// results, leaderboard, meta, emailLog) and bypasses these rules. It does NOT emit per-doc
// delete events, so onResultWrite / onGameClose do not fire during a delete.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
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
  if (typeof gameId !== 'string' || !gameId) {
    throw new HttpsError('invalid-argument', 'Which game?');
  }
  if (!(await db.doc(`games/${gameId}`).get()).exists) {
    throw new HttpsError('not-found', 'That game no longer exists.');
  }

  await db.recursiveDelete(db.doc(`games/${gameId}`));
  return { deleted: true };
});
