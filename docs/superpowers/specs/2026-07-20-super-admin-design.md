# Super Admin — Edit live games & delete games

**Status:** approved design, pre-implementation
**Date:** 2026-07-20
**Related:** [`2026-06-26-shared-admin-permissions-design.md`](./2026-06-26-shared-admin-permissions-design.md) (the pod-wide any-admin model this builds on)

## Summary

Two new **Super-Admin-only** capabilities:

1. **Edit a live (`OPEN`) game** — its matches, options, prop bets, poster, name, event
   date, and `lockTime`. Closed games stay frozen.
2. **Delete a game** — any status, hard and irreversible, via an Admin-SDK Cloud Function.

"Super Admin only" is the boundary for **both**. The pod-wide model is unchanged: any admin
still creates, runs (enters live results), and closes any game. Editing the structure of a
published game and deleting a game are the two elevated actions, alongside the existing
Super-Admin-only "manage admins."

## Motivation

Today a game is immutable after creation except for entering results and closing it
(`createGame` and `closeGame` are the only game-doc writes — `src/lib/store.ts:141`, `:241`).
There is no way to fix a typo, correct a wrong option, add a late-announced match, adjust the
lock time, or attach a poster to an already-published game — and no way to remove a game
created by mistake. This closes both gaps for Super Admins.

## Background: the current state (grounding facts)

These are load-bearing facts from the codebase that shape the design:

- **"Published" = `OPEN`.** `GameStatus` has five values but only `OPEN` and `CLOSED` are ever
  written. `createGame` writes `status: 'OPEN'` (`src/lib/store.ts:149`); `closeGame` is the
  only transition, to `CLOSED` (`src/lib/store.ts:241-246`). There is no DRAFT stage — a game
  is live the moment it's created.
- **"Locked" is the clock, not a status.** Picks freeze when `request.time` passes `lockTime`,
  enforced server-side in rules (`firestore.rules`, `pastLock`/`gameLocked`). An in-progress
  game is `OPEN` with a past `lockTime`; it never becomes a stored `LOCKED`.
- **Picks are keyed by option _text_.** A submission stores `matchPicks: { [questionId]:
  chosenOptionString }` and `propBetPicks` likewise (`src/types.ts:83-85`). Scoring compares
  the stored string against the result string. **Therefore renaming or removing an option that
  a player already picked silently orphans their pick** — it can never match a result again.
  This is the central hazard the edit feature must guard.
- **A game has five subcollections, and Firestore does not cascade:** `submissions`, `results`,
  `leaderboard`, `meta` (the results-email record), `emailLog`. A delete must remove all of them.
- **The client cannot delete submissions.** `submissions/{u}` has `allow delete: if false` and
  `leaderboard` has `allow write: if false` (functions-only). A client-side recursive delete
  would half-succeed. Delete **must** go through the Admin SDK.
- **Delete is already permitted in rules** for `isSuperAdmin()` on the game doc
  (`firestore.rules`, `games/{gameId}` `allow delete`) — there is simply no code that calls it.
- **Closed games are frozen** in three layers (rules: `update` requires `status != 'CLOSED'`;
  client: `readOnly` when closed; functions: `onGameClose` guards the entering edge). This
  invariant is preserved — editing is `OPEN`-only.
- **Super-Admin gating pattern** is in-component (`user.role === 'superadmin'`, as in
  `AdminManagement.tsx` and the "Manage admins" link in `AdminGames.tsx`). `ProtectedRoute`
  only distinguishes `adminOnly` today.

## Decisions (from the brainstorm)

| Decision | Choice |
|---|---|
| Who can edit a published game | **Super Admin only** |
| Edit model | **Full edit** + pick-aware **admin warning** on save |
| Player notification | **Targeted "re-pick" flag** only (orphaned pick / newly-added question). **No** full changelog in v1. |
| Closed games | **OPEN-only editing.** Freeze preserved. Delete still allowed on any status. |
| Delete guard | **Type-to-confirm**, any game, showing what will be destroyed. Hard delete. |

## Design

### 1. Edit a live game

**Permission enforcement — rules, not just UI.** The `games/{gameId}` update rule is tightened
so that:

- **Any admin** may update **only to close the game** — the affected keys are limited to
  `status` and `tiebreakerAnswer` (the existing `closeGame` operation), and only while not
  already `CLOSED`.
- **A Super Admin** may update any field of a non-`CLOSED` game (the structural edit).

Sketch (final form TDD'd against the emulator):

```
allow update: if resource.data.status != 'CLOSED' && (
  isSuperAdmin()
  || (isAdmin()
      && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'tiebreakerAnswer']))
);
```

This keeps structural editing Super-Admin-only at the trust boundary, so a plain admin cannot
restructure a game via a direct API call, while `closeGame` (any admin) keeps working. It does
**not** loosen anything for closed games. `standingsSentFor` is written by the
`sendNightStandings` callable via the Admin SDK (bypasses rules), so the narrowed rule does not
need to allow it.

> **Risk flag.** This touches the Firestore rules — the layer that has repeatedly shipped silent
> bugs in this project (see CLAUDE.md, "the dashboard's collection-group query"). It will be
> built test-first against the emulator (see Testing). No structural edit ships until the rules
> tests pin: plain-admin-can-close, plain-admin-cannot-restructure, super-admin-can-restructure,
> closed-game-rejects-both.

**Client — `updateGame`.** A new store function mirroring `createGame`:

```
updateGame(gameId: string, input: NewGameInput): Promise<void>
```

It writes the edited `name`, `promotion`, `eventDate`, `lockTime`, `dayCount`, `matches`,
`propBets`, `tiebreakerQuestion` back to the existing game doc via `updateDoc`. It does **not**
touch `status`, `createdBy`, `admins`, `joinCode`, `createdAt`, or `standingsSentFor`.

**Edit UI.** Reuse GameBuilder's `QuestionBuilder` pieces in an edit mode:

- Route `/admin/game/:gameId/edit`, Super-Admin-gated.
- Hydrate the form's initial state from the loaded game (matches/props/fields) instead of empty.
- On save, call `updateGame` instead of `createGame`.
- Entry point: an **Edit** button on the `AdminGame` header, rendered only for
  `user.role === 'superadmin'`.

Poster fields reuse the existing `PosterPicker` and its ingest flow unchanged — this is how a
Super Admin attaches a poster to an already-published game (the concrete motivating case).

**Admin-side pick-orphan warning.** Before committing an edit, compute the impact against the
game's existing submissions (a Super Admin can read them):

- For each match/prop, if an **option was removed or renamed** and any submission's saved pick
  for that question equals the old option string → that pick is orphaned.
- If a **question was deleted** and any submission has a pick for it → orphaned.

If the pending edit orphans any picks, show a confirmation summarizing counts —
*"3 players picked 'Roman Reigns', which you're removing. Their picks for this match will no
longer score. Continue?"* — and require explicit confirmation before `updateGame` runs. A
clean edit (adding a question, fixing a poster, renaming the game) saves without a prompt.

**Player-side targeted flag.** Derived entirely from current state; no new storage. On the
player's picks/dashboard view, for the player's own submission:

- **Orphaned pick:** a saved `matchPicks[qid]` / `propBetPicks[qid]` whose value is not among
  that question's current `options` → flag the question *"This was changed — re-pick."*
- **New unanswered question:** a current question the submission has no pick for → same flag.

While the game is pre-lock, the flag links the player to re-pick (their existing submission is
still writable by the rules). Once past `lockTime`, picks are frozen by the clock, so the flag
is informational only (transparency that their pick was affected) — it does not imply they can
change it. This is acceptable: the admin-side warning already surfaced the scoring impact at
edit time.

### 2. Delete a game

**`deleteGame` Cloud Function (callable).** Super-Admin-only. Mandatory mechanism because the
client cannot delete `submissions`/`leaderboard`.

```
export const deleteGame = onCall(async (req) => {
  // 1. require signed-in; look up users/{uid}; role must be 'superadmin' → else permission-denied
  // 2. require gameId; game must exist → else not-found
  // 3. await getFirestore().recursiveDelete(db.doc(`games/${gameId}`))
  // 4. return { deleted: true }
});
```

Notes:
- `firebase-admin ^12` provides `recursiveDelete`, which removes the doc and every subcollection
  and **bypasses security rules** — the reason it can clear the `allow delete: if false`
  submissions.
- `recursiveDelete` does **not** emit per-document delete events, so `onResultWrite` /
  `onGameClose` do not fire during a delete — no cleanup-trigger side effects.
- Region pinned `us-west1`, consistent with the other functions. New product/deploy steps: none
  (Functions already enabled).

**Delete UI — type-to-confirm.** Super-Admin-gated, reachable from the `AdminGame` header
(and optionally the `AdminGames` list row). A dialog that:

- States the game name and that deletion is **permanent and cannot be undone.**
- Shows what will be destroyed, with real counts read from the game (e.g. *"18 players' picks,
  all results, the leaderboard, and the email log."*).
- Requires the operator to **type the game's exact name** to enable the Delete button (the
  GitHub "delete repository" pattern).
- On success, navigates to `/admin` and surfaces a confirmation toast. On failure, shows the
  error (never a silent no-op).

### 3. Demo mode

Both features depend on Firebase. When `isFirebaseConfigured` is false:

- The **Edit** and **Delete** entry points render **disabled**, with a short explanation
  ("Editing/Deleting needs a live Firebase connection — unavailable in demo mode."), matching
  the existing pattern in `NightStandingsButton` (`LiveControlPanel.tsx:108-112`). Never a dead
  button or a crash.

### 4. Gating summary

| Action | UI gate | Enforced by |
|---|---|---|
| See Edit/Delete controls | `user.role === 'superadmin'` in-component | — |
| Edit route `/admin/game/:gameId/edit` | Super-Admin route guard | — |
| Structural game edit | — | **Firestore rules** (tightened `update`) |
| Delete game | — | **`deleteGame` callable** (`role === 'superadmin'`) + rules `allow delete: if isSuperAdmin()` |

## Testing

- **Rules (emulator, `tests/e2e/rules.test.ts`)** — the highest-value tests, built test-first:
  - a plain admin can still close a game (affected keys `status`+`tiebreakerAnswer`);
  - a plain admin **cannot** change `matches`/`propBets`/`lockTime`/`name` (structural);
  - a Super Admin **can** make a structural edit on an `OPEN` game;
  - neither can update a `CLOSED` game (freeze preserved);
  - delete is denied for a plain admin and allowed for a Super Admin (already partly covered by
    the existing "lets only a super admin delete a game" test — extend as needed).
- **Unit** — `updateGame` writes only the intended fields and never `status`/`createdBy`/
  `admins`/`joinCode`/`standingsSentFor`. Pick-orphan detection: given a submission and an
  edited game, it flags exactly the orphaned questions (removed option, renamed option, deleted
  question, newly-added question) and nothing else.
- **`deleteGame`** — server-side logic (role check, not-found). Full emulator coverage of the
  callable is a stretch goal (tracked with the existing standings-coverage gap, issue #19);
  at minimum the role gate and the recursive-delete call path are unit-checked.
- **Manual** — per CLAUDE.md "verify before claiming done," drive the real flows: attach a
  poster to the existing published game via Edit; edit an option and confirm the warning fires
  and the player sees the re-pick flag; delete a throwaway game and confirm all subcollections
  are gone (query Firestore directly, don't infer).

## Out of scope (v1)

- Editing or re-opening **closed** games (the freeze is deliberate).
- The full **"what changed since you picked" changelog** (persisted edit history) — deferred;
  the targeted re-pick flag covers the scoring-critical cases without new storage.
- Soft-delete / archive / undo — delete is hard by decision.
- A bulk "delete all closed games" action.

## Invariants preserved (CLAUDE.md checklist)

- Access is by **global role**, never by `createdBy` or per-game membership — edit/delete gate on
  `superadmin` role only.
- **Closed games are frozen** — editing is `OPEN`-only; the closed-update rule is untouched.
- The **server-clock pick lock** is not replaced by a status check — unaffected; the player
  re-pick flag respects it (informational past lock).
- **Posters are always re-hosted** in our bucket — edit reuses `PosterPicker`/ingest unchanged;
  no third-party URL is persisted.
- **`src/lib/scoring.ts` and `functions/src/scoring.ts` stay mirrored** — this feature does not
  change scoring.
- **No secrets committed.**
- **Copy** uses Pop / Drop / Pop Count / Pop Rankings only.
