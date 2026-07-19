// sendNightStandings — admin-triggered interim standings email for a multi-night card.
//
// Why this is a callable and not a trigger: onGameClose hangs off a `status -> CLOSED`
// document transition. An admin saying "night 1 is done, tell the pod" has no such
// transition, and the client can't send directly because RESEND_API_KEY is server-only.
//
// What it must NOT do: touch `status`. Closed games are frozen for everyone, so an interim
// send has to leave the game mid-show and still gradeable. See
// docs/superpowers/specs/2026-07-19-multi-night-events-design.md.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { GameDoc } from './scoring';
import { sendStandingsEmail } from './index';

type NightGameDoc = GameDoc & {
  name?: string;
  eventDate?: string;
  dayCount?: number;
  standingsSentFor?: number[];
};

/** Mirrors src/lib/nights.ts — out-of-range or missing days fall back to night 1. */
function nightOf(q: { day?: number }, total: number): number {
  const d = Number(q.day ?? 1);
  if (!Number.isFinite(d)) return 1;
  return Math.min(Math.max(Math.floor(d), 1), total);
}

export const sendNightStandings = onCall<{ gameId?: string; night?: number }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const db = getFirestore();
  const profile = await db.doc(`users/${uid}`).get();
  const role = profile.data()?.role;
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Only admins can send standings.');
  }

  const gameId = request.data?.gameId;
  const night = Number(request.data?.night);
  if (typeof gameId !== 'string' || !gameId || !Number.isFinite(night) || night < 1) {
    throw new HttpsError('invalid-argument', 'Which game and night?');
  }

  const gameSnap = await db.doc(`games/${gameId}`).get();
  if (!gameSnap.exists) throw new HttpsError('not-found', 'That game no longer exists.');
  const game = gameSnap.data() as NightGameDoc;

  const total = Math.max(1, Number(game.dayCount ?? 1) || 1);
  if (night > total) throw new HttpsError('invalid-argument', `This game only runs ${total} night(s).`);
  if (night === total) {
    throw new HttpsError(
      'failed-precondition',
      'The final night is covered by the results email sent when you close the game.',
    );
  }

  // Already sent. Checked server-side, not just by a disabled button — the failure mode
  // here is mailing the whole pod twice.
  if ((game.standingsSentFor ?? []).includes(night)) {
    throw new HttpsError('already-exists', `Night ${night} standings have already been sent.`);
  }

  // Every question for that night must be graded, or the standings are misleading.
  const nightQuestionIds = [
    ...game.matches.filter((m) => nightOf(m, total) === night).map((m) => m.id),
    ...game.propBets.filter((p) => nightOf(p, total) === night).map((p) => p.id),
  ];
  if (nightQuestionIds.length === 0) {
    throw new HttpsError('failed-precondition', `Night ${night} has no questions.`);
  }

  const resultsSnap = await db.collection(`games/${gameId}/results`).get();
  const graded = new Set(
    resultsSnap.docs.filter((d) => ((d.data().correctAnswer as string) ?? '') !== '').map((d) => d.id),
  );
  const ungraded = nightQuestionIds.filter((id) => !graded.has(id));
  if (ungraded.length > 0) {
    throw new HttpsError(
      'failed-precondition',
      `${ungraded.length} Night ${night} pick(s) still need a result before standings can go out.`,
    );
  }

  // Nobody has submitted picks yet, so there are no standings and nobody to mail. This must
  // be checked BEFORE claiming the night below: sendStandingsEmail no-ops on an empty
  // leaderboard, so claiming first would burn the send permanently on a premature click and
  // leave the button disabled forever once players did submit.
  const boardSnap = await db.doc(`games/${gameId}/leaderboard/current`).get();
  const entryCount = ((boardSnap.data()?.entries as unknown[]) ?? []).length;
  if (entryCount === 0) {
    throw new HttpsError(
      'failed-precondition',
      'No one has submitted picks for this game yet, so there are no standings to send.',
    );
  }

  // Claim the night BEFORE sending. If the send partially fails we'd rather under-send than
  // let a retry mail everyone a second time; per-recipient failures are logged to emailLog.
  await gameSnap.ref.update({ standingsSentFor: FieldValue.arrayUnion(night) });

  await sendStandingsEmail(gameId, game, 'interim', night);
  logger.info(`Night ${night} standings sent for game ${gameId} to ${entryCount} player(s) by ${uid}.`);

  return { sent: true, night, recipients: entryCount };
});
