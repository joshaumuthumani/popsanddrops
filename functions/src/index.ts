// Pops & Drops Cloud Functions (PRD §8.2). Deployed to us-west1 to sit next to Firestore.
//   • onResultWrite        — recompute Pop/Drop scores + leaderboard on every result entry.
//   • onGameClose          — on status -> CLOSED, apply the tiebreaker and email final results.
//   • ingestPosterFromUrl  — re-host a pasted match-poster link into our own Storage bucket.
//   • sendNightStandings   — admin-triggered interim standings for a multi-night card.
//   • deleteGame           — super-admin-only hard delete of a game + all its subcollections.
// The leaderboard doc lives at games/{gameId}/leaderboard/current (single doc, single listener).

import { onDocumentWritten, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { computeLeaderboard, type GameDoc, type Results, type SubmissionDoc } from './scoring';

initializeApp();
setGlobalOptions({ region: 'us-west1' });
const db = getFirestore();

// Match-poster URL ingest lives in its own module; re-exported so it deploys with the rest.
export { ingestPosterFromUrl } from './posters';
// Admin-triggered interim standings for multi-night cards.
export { sendNightStandings } from './standings';
// Super-Admin-only hard delete (game + all subcollections) via Admin-SDK recursiveDelete.
export { deleteGame } from './deleteGame';

/** Reads a game's submissions + results, writes back per-submission scores and the leaderboard doc. */
export async function recomputeGame(gameId: string): Promise<void> {
  const gameSnap = await db.doc(`games/${gameId}`).get();
  if (!gameSnap.exists) return;
  const game = gameSnap.data() as GameDoc;

  const [subsSnap, resultsSnap] = await Promise.all([
    db.collection(`games/${gameId}/submissions`).get(),
    db.collection(`games/${gameId}/results`).get(),
  ]);

  const subs: SubmissionDoc[] = subsSnap.docs.map((d) => d.data() as SubmissionDoc);
  const results: Results = {};
  resultsSnap.docs.forEach((d) => {
    const c = (d.data().correctAnswer as string) ?? '';
    if (c !== '') results[d.id] = c;
  });

  const board = computeLeaderboard(game, subs, results);

  const batch = db.batch();
  for (const row of board) {
    batch.set(
      db.doc(`games/${gameId}/submissions/${row.uid}`),
      { popCount: row.popCount, dropCount: row.dropCount, rank: row.rank },
      { merge: true },
    );
  }
  batch.set(db.doc(`games/${gameId}/leaderboard/current`), {
    entries: board,
    updatedAt: Date.now(),
  });
  await batch.commit();
  logger.info(`Recomputed leaderboard for game ${gameId}: ${board.length} players.`);
}

export const onResultWrite = onDocumentWritten('games/{gameId}/results/{questionId}', async (event) => {
  await recomputeGame(event.params.gameId);
});

export const onGameClose = onDocumentUpdated('games/{gameId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.status === 'CLOSED' || after.status !== 'CLOSED') return; // only the OPEN/LOCKED -> CLOSED edge

  const gameId = event.params.gameId;
  await recomputeGame(gameId); // status is now CLOSED, so the tiebreaker is applied
  const outcome = await sendStandingsEmail(
    gameId,
    after as GameDoc & { name?: string; eventDate?: string },
    'final',
  );

  // Record what actually happened. This is the highest-stakes send in the app and the one with
  // no retry button — closing is one-way — so a failure that only ever reached a Cloud
  // Functions log line would be invisible to the person who needs to know.
  //
  // Written to a subcollection, NOT merged into games/{id}: closed games are frozen, and
  // recomputeGame already sets the precedent that post-close bookkeeping lives beside the game
  // rather than in it. This also avoids re-triggering onGameClose on the game document.
  if (outcome.delivered === 0) {
    logger.error(`Final results email for game ${gameId} reached nobody.`, outcome);
  }
  await db.doc(`games/${gameId}/meta/resultsEmail`).set({ ...outcome, at: Date.now() });
});

/**
 * Sends a standings email via Resend (Phase 2). No-ops with a log if Resend isn't configured.
 *
 * Two variants share this plumbing:
 *   • 'final'   — the recap after a game closes (onGameClose).
 *   • 'interim' — mid-event standings after one night is graded (sendNightStandings).
 *
 * Standings are READ from the leaderboard doc, never recomputed here: onResultWrite already
 * keeps games/{id}/leaderboard/current up to date on every result entry.
 *
 * Returns what actually happened rather than resolving unconditionally. Callers that record
 * a send as done — sendNightStandings claims the night in `standingsSentFor` — must not treat
 * "the promise resolved" as "mail went out"; every recipient can fail independently.
 */
export interface SendOutcome {
  /** Recipients Resend accepted. Zero here means nobody heard anything. */
  delivered: number;
  /** Recipients whose send threw; each also has a games/{id}/emailLog/{uid} entry. */
  failed: number;
  /** Participants with no email on their user doc — nothing was attempted for them. */
  noAddress: number;
  /** False when RESEND_API_KEY is unset, i.e. Phase 2 isn't configured in this environment. */
  configured: boolean;
}

export async function sendStandingsEmail(
  gameId: string,
  game: GameDoc & { name?: string; eventDate?: string },
  variant: 'final' | 'interim',
  night?: number,
): Promise<SendOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? 'Pops & Drops <noreply@popsanddrops.us>';
  const appUrl = process.env.APP_PUBLIC_URL ?? 'https://popsanddrops.web.app';

  const boardSnap = await db.doc(`games/${gameId}/leaderboard/current`).get();
  const entries = (boardSnap.data()?.entries as { uid: string; displayName: string; popCount: number; rank: number }[]) ?? [];
  if (entries.length === 0) {
    logger.info(`No participants to email for game ${gameId}.`);
    return { delivered: 0, failed: 0, noAddress: 0, configured: true };
  }
  if (!apiKey) {
    logger.warn(`RESEND_API_KEY not set — skipping results email for game ${gameId} (Phase 2 not configured).`);
    return { delivered: 0, failed: 0, noAddress: 0, configured: false };
  }

  const top3 = entries.filter((e) => e.rank <= 3).slice(0, 3);
  const leader = entries.find((e) => e.rank === 1);
  // ?view=rankings so the link honours its own label — without it the app opens on Make
  // Picks and the reader lands on a pick sheet instead of the board they clicked for.
  const scoreboardLink = `${appUrl}/app/game/${gameId}?view=rankings`;
  const gameName = game.name ?? 'the challenge';
  const isInterim = variant === 'interim';

  const top3Html = top3
    .map((e) => `<tr><td style="padding:4px 12px">#${e.rank}</td><td style="padding:4px 12px">${escapeHtml(e.displayName)}</td><td style="padding:4px 12px"><strong>${e.popCount}</strong> Pops</td></tr>`)
    .join('');

  const heading = isInterim
    ? `Night ${night} standings — ${escapeHtml(gameName)}`
    : `Final Pops — ${escapeHtml(gameName)}`;
  const leadLine = leader
    ? isInterim
      ? `<p>🔥 <strong>${escapeHtml(leader.displayName)}</strong> leads with ${leader.popCount} Pops going into the next night.</p>`
      : `<p>🏆 <strong>${escapeHtml(leader.displayName)}</strong> takes it with ${leader.popCount} Pops. Congrats!</p>`
    : '';
  const tail = isInterim
    ? `<p style="color:#555">Picks are already locked — there's still a night to play, so the board can still move.</p>`
    : '';

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px">
      <h2>${heading}</h2>
      ${leadLine}
      <table style="border-collapse:collapse">${top3Html}</table>
      ${tail}
      <p><a href="${scoreboardLink}">View the full Pop Rankings →</a></p>
      <p style="color:#8a8a8a;font-size:12px;margin-top:28px;border-top:1px solid #e5e5e5;padding-top:12px">
        This is an automated message from Pops & Drops — please do not reply, this inbox is not monitored.
      </p>
    </div>`;

  // Look up each participant's email and send. Failures are logged for admin visibility (PRD §4.7)
  // AND counted — the caller needs to know whether anything actually landed. Swallowing these
  // silently let a totally failed send (bad key, unverified domain, Resend outage) report success.
  const outcomes = await Promise.all(
    entries.map(async (e): Promise<'delivered' | 'failed' | 'noAddress'> => {
      try {
        const userSnap = await db.doc(`users/${e.uid}`).get();
        const email = userSnap.data()?.email as string | undefined;
        if (!email) return 'noAddress';
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from,
            to: email,
            subject: isInterim ? `Night ${night} Standings — ${gameName}` : `Final Results — ${gameName}`,
            html,
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend ${res.status}: ${body}`);
        }
        return 'delivered';
      } catch (err) {
        logger.error(`Failed to email ${e.uid} for game ${gameId}`, err);
        await db.doc(`games/${gameId}/emailLog/${e.uid}`).set({
          error: String(err),
          failedAt: Date.now(),
        });
        return 'failed';
      }
    }),
  );

  const outcome: SendOutcome = {
    delivered: outcomes.filter((o) => o === 'delivered').length,
    failed: outcomes.filter((o) => o === 'failed').length,
    noAddress: outcomes.filter((o) => o === 'noAddress').length,
    configured: true,
  };
  logger.info(
    `${variant} standings emails for game ${gameId}: ` +
      `${outcome.delivered} delivered, ${outcome.failed} failed, ${outcome.noAddress} without an address.`,
  );
  return outcome;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
