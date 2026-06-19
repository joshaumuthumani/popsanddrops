// Pops & Drops Cloud Functions (PRD §8.2). Deployed to us-west1 to sit next to Firestore.
//   • onResultWrite — recompute Pop/Drop scores + leaderboard on every result entry.
//   • onGameClose   — on status -> CLOSED, apply the tiebreaker and email final results.
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

/** Reads a game's submissions + results, writes back per-submission scores and the leaderboard doc. */
async function recomputeGame(gameId: string): Promise<void> {
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
  await sendResultsEmail(gameId, after as GameDoc & { name?: string; eventDate?: string });
});

/** Sends the Final Pops email via Resend (Phase 2). No-ops with a log if Resend isn't configured. */
async function sendResultsEmail(
  gameId: string,
  game: GameDoc & { name?: string; eventDate?: string },
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? 'Pops & Drops <onboarding@resend.dev>';
  const appUrl = process.env.APP_PUBLIC_URL ?? 'https://popsanddrops.web.app';

  const boardSnap = await db.doc(`games/${gameId}/leaderboard/current`).get();
  const entries = (boardSnap.data()?.entries as { uid: string; displayName: string; popCount: number; rank: number }[]) ?? [];
  if (entries.length === 0) {
    logger.info(`No participants to email for game ${gameId}.`);
    return;
  }
  if (!apiKey) {
    logger.warn(`RESEND_API_KEY not set — skipping results email for game ${gameId} (Phase 2 not configured).`);
    return;
  }

  const top3 = entries.filter((e) => e.rank <= 3).slice(0, 3);
  const winner = entries.find((e) => e.rank === 1);
  const scoreboardLink = `${appUrl}/app/game/${gameId}`;
  const gameName = game.name ?? 'the challenge';

  const top3Html = top3
    .map((e) => `<tr><td style="padding:4px 12px">#${e.rank}</td><td style="padding:4px 12px">${escapeHtml(e.displayName)}</td><td style="padding:4px 12px"><strong>${e.popCount}</strong> Pops</td></tr>`)
    .join('');
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px">
      <h2>Final Pops — ${escapeHtml(gameName)}</h2>
      ${winner ? `<p>🏆 <strong>${escapeHtml(winner.displayName)}</strong> takes it with ${winner.popCount} Pops. Congrats!</p>` : ''}
      <table style="border-collapse:collapse">${top3Html}</table>
      <p><a href="${scoreboardLink}">View the full Pop Rankings →</a></p>
    </div>`;

  // Look up each participant's email and send. Failures are logged for admin visibility (PRD §4.7).
  await Promise.all(
    entries.map(async (e) => {
      try {
        const userSnap = await db.doc(`users/${e.uid}`).get();
        const email = userSnap.data()?.email as string | undefined;
        if (!email) return;
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to: email, subject: `Final Results — ${gameName}`, html }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend ${res.status}: ${body}`);
        }
      } catch (err) {
        logger.error(`Failed to email ${e.uid} for game ${gameId}`, err);
        await db.doc(`games/${gameId}/emailLog/${e.uid}`).set({
          error: String(err),
          failedAt: Date.now(),
        });
      }
    }),
  );
  logger.info(`Results emails dispatched for game ${gameId}.`);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
