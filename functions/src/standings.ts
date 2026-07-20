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
import { recomputeGame, sendStandingsEmail } from './index';

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

  // Fast, friendly rejection for the common case. This is NOT the authoritative check — two
  // racing calls can both pass it. The binding one is the transaction below.
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

  // Rebuild the leaderboard first, exactly as onGameClose does before the final email.
  // leaderboard/current is only written by onResultWrite, so anyone who submitted AFTER the
  // last result was entered is missing from it — which made this function report "nobody has
  // submitted" while the admin was looking at that player in the Players tab.
  await recomputeGame(gameId);

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

  // Claim the night BEFORE sending, so a double-click or a second admin can't mail everyone
  // twice. The read and the write must be atomic: checking the snapshot fetched at the top of
  // this function and then writing would let two racing calls both pass the check and both
  // send. Whoever loses the transaction gets 'already-exists' and never reaches the send —
  // which is also what makes the rollback below safe, since only the winner can roll back.
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(gameSnap.ref);
    const sentFor = (fresh.data()?.standingsSentFor as number[] | undefined) ?? [];
    if (sentFor.includes(night)) {
      throw new HttpsError('already-exists', `Night ${night} standings have already been sent.`);
    }
    tx.update(gameSnap.ref, { standingsSentFor: FieldValue.arrayUnion(night) });
  });

  const outcome = await sendStandingsEmail(gameId, game, 'interim', night);

  // A TOTAL failure is a different case, and it used to be invisible: every per-recipient send
  // is caught and logged, so a bad API key, an unverified domain or a Resend outage failed all
  // of them while this function still returned success — with the night permanently burned and
  // the button disabled forever. Release the claim so the admin can genuinely retry, and fail
  // loudly rather than reporting a send that never happened.
  //
  // A PARTIAL failure keeps the claim: retrying would mail the successful recipients twice, so
  // we under-send deliberately and report the count back instead. Failures land in emailLog.
  if (outcome.delivered === 0) {
    // The release can itself fail. If it does, the night stays claimed and the admin is in
    // exactly the stuck state this whole change exists to prevent — so say so explicitly
    // rather than letting a raw Firestore error surface as if the send were the problem.
    let released = true;
    try {
      await gameSnap.ref.update({ standingsSentFor: FieldValue.arrayRemove(night) });
    } catch (err) {
      released = false;
      logger.error(`Could not release the Night ${night} claim on game ${gameId}.`, err);
    }
    logger.error(
      `Night ${night} standings for game ${gameId} reached nobody (claim ${released ? 'released' : 'STUCK'}).`,
      outcome,
    );
    if (!released) {
      throw new HttpsError(
        'internal',
        `Couldn't send the Night ${night} standings, and couldn't undo the attempt. ` +
          'The button will stay disabled for this night until it\'s cleared manually — tell your organizer.',
      );
    }
    throw new HttpsError(
      'internal',
      outcome.configured
        ? `Couldn't send the Night ${night} standings — no email reached anyone. Nothing was recorded, so you can try again.`
        : 'Email isn\'t configured for this environment (RESEND_API_KEY is not set), so no standings were sent.',
    );
  }

  logger.info(
    `Night ${night} standings sent for game ${gameId} by ${uid}: ` +
      `${outcome.delivered} delivered, ${outcome.failed} failed, ${outcome.noAddress} without an address.`,
  );

  // noAddress travels with the rest. A player with no email on their user doc gets nothing,
  // and dropping that count here would have left the admin reading a clean "standings sent"
  // while part of the pod heard nothing — the exact failure this whole change is about.
  return {
    sent: true,
    night,
    recipients: outcome.delivered,
    failed: outcome.failed,
    noAddress: outcome.noAddress,
  };
});
