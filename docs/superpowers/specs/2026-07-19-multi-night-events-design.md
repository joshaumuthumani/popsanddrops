# Multi-Night Events — Design

**Date:** 2026-07-19
**Status:** Approved, ready for implementation plan

## Goal

Support events that run across more than one night — SummerSlam, WrestleMania — without turning the picks screen into one undifferentiated list of twenty-plus questions.

An admin sets a **number of nights** when creating a game (default **1**), assigns each match and prop bet to a night, and every screen that lists questions groups them under night headings.

Separately, admins can send an **interim standings email** once a night's results are all in, so the pod sees who's leading going into the final night.

## Framing decision

**It is one game played over two nights — not two games.** Everything that makes it a single contest stays single:

- one submission document per player
- one lock time, before Night 1
- one leaderboard, one Pop Count, one tiebreaker
- one progress indicator ("14 of 20 locked in")

Nights are a **presentational grouping**, not a scoring or access-control boundary. This framing is the reason the change is cheap, and it is the thing to preserve if the design is revisited.

## Scope decisions

| Question | Decision |
|---|---|
| When do picks lock? | **Once, before Night 1.** Players predict the whole event up front. |
| Nesting | **Night first, sections inside** — `NIGHT 1` → its matches → its prop bets, then `NIGHT 2`. |
| Presentation | **Stacked sections with headings.** Not tabs — tabs would read as two separate contests. |
| Labels | `NIGHT 1`, `NIGHT 2`, … auto-derived. No custom naming. |
| Interim email trigger | **Admin presses a button**, enabled once that night is fully graded. |

### Why not per-night lock times

Locking each night separately (Night 1 freezes Saturday, Night 2 stays open until Sunday) is more true to how people watch, and was explicitly considered. It was rejected for v1 because it requires **partial locking of a single submission document**: between the two locks, a player must be able to edit Night 2 answers while Night 1 answers stay frozen. Firestore rules would have to prove that the Night-1 subset of `matchPicks`/`propBetPicks` is unchanged, which means either a rules-side mapping of question → night, or splitting submissions into per-night documents. The latter ripples into scoring, the leaderboard, the collection-group dashboard query, and the results email.

Deferred deliberately. If it is ever picked up, it is a re-architecture, not an increment.

### Why not tabs

The stated problem is that a long flat list is unusable. Tabs would cut the visible list in half, but they would also imply two separate contests — splitting the mental model of the progress bar, the board, and the single submission. Stacked sections with strong headings solve the scanning problem while keeping the "one game" framing. If scroll length is still a problem in practice, making each night collapsible is a small follow-on.

## Current state

- `src/types.ts` — `Game { matches: Match[]; propBets: PropBet[]; lockTime: number; … }`. Both question arrays are flat; nothing carries a night.
- `src/lib/scoring.ts` — `questionIds(game)` flattens `game.matches` + `game.propBets`. `tally()` and `buildLeaderboard()` consume that flat list.
- `functions/src/scoring.ts` — mirror of the above.
- `firestore.rules` — one `lockTime` per game, enforced by server clock across the whole submission document.
- `src/pages/admin/GameBuilder.tsx` — shared `QuestionBuilder` renders matches and prop bets from a common `DraftQuestion`.
- `src/pages/user/MakePicks.tsx` — two fixed sections; `MatchCard` handles poster/no-poster layouts.
- Read surfaces that list questions: `LiveControlPanel`, `PopRankings`, `GameResultsBoard` / `GameResultsModal`, and the recap email in `functions/src/index.ts`.

## Design — Story 1: night grouping

### 1. Data model

```ts
export interface Game {
  // …unchanged…
  /** How many nights the event runs. 1 for a normal single-night card. */
  dayCount: number;
}

export interface Match {
  // …unchanged…
  /** 1-based night this match belongs to. Absent ⇒ night 1. */
  day?: number;
}

export interface PropBet {
  // …unchanged…
  day?: number;
}
```

A flat array with a `day` tag was chosen over restructuring `Game` into `days: Day[]` with questions nested inside. Nesting would break every existing game, require a migration, and — decisively — break `questionIds()`, which flattens both arrays.

**Consequence worth stating plainly: `src/lib/scoring.ts` and `functions/src/scoring.ts` require no changes at all.** Tally, ranking, tiebreaker, and leaderboard construction all keep working, because they iterate the same flat arrays they always did. The mirror invariant is never at risk.

`normalizeGame()` in `src/lib/store.ts` defaults `dayCount` to `1` when absent, so existing game documents need no migration and render exactly as they do today.

### 2. Shared grouping helper

One helper, used by every surface, so the grouping rule lives in a single place:

```ts
/** Groups a game's questions by night, in night order. Untagged questions fall in night 1. */
export function questionsByDay(game: Game): Array<{
  day: number;
  label: string;          // "NIGHT 1"
  matches: Match[];
  propBets: PropBet[];
}>
```

Lives in `src/lib/scoring.ts` alongside `questionIds` (pure, no Firebase). When `dayCount <= 1` it returns a single unlabelled group, letting callers use one code path for both cases.

### 3. Game Builder

- A **"Number of nights"** number input beside the event date, min 1, default 1.
- **When the count is 1, no night controls render anywhere.** The single-night flow — the common case — is visually unchanged.
- At 2+, each match and prop bet card gains a compact night selector, defaulting to night 1.
- Lowering the count reassigns questions from removed nights down to the new last night rather than dropping them silently.
- `publish()` writes `dayCount`, and `day` on each question (omitted when 1, so nothing extra is stored for single-night games).

### 4. Make Picks

Renders `questionsByDay(game)`. For each night: a night heading, then that night's matches, then that night's prop bets, reusing the existing `MatchCard` and prop-bet markup untouched.

The progress bar and the "Lock In Your Picks" button stay **whole-game** — one submission, one lock.

When `dayCount === 1` the output is byte-identical to today's: no night heading, same two sections.

### 5. Other read surfaces

Same helper, same grouping, all read-only:

- `LiveControlPanel` — night headings over the results-entry list.
- `PopRankings` "Your Picks" — night headings.
- `GameResultsBoard` / `GameResultsModal` — night headings.
- Recap email (`functions/src/index.ts`) — results listed under night headings.

## Design — Story 2: interim standings email

Depends on Story 1 (there is no "night" to report on without it).

- **Trigger:** an admin button, one per night, in the admin game panel. Enabled only when every question for that night has a result recorded, and never for the final night (that night's report is the existing recap email).
- **Single-send guard:** the game document records which nights have been reported, e.g. `standingsSentFor: number[]`. The button disables once its night is listed. This matters because — unlike `onGameClose`, which fires on a one-way `status → CLOSED` transition — nothing else prevents an admin from mailing the whole pod twice.
- **Delivery — how much is reused.** The *sending* is largely existing code; the *trigger* is not.
  - **Reused:** `sendResultsEmail()` already reads `leaderboard/current`, loops recipients, resolves each address, posts to Resend, and logs per-recipient failures to `emailLog`. Extract it to `sendStandingsEmail(gameId, game, variant)` with `variant: 'interim' | 'final'`; the existing close path calls it with `'final'`. One new template, same plumbing.
  - **No recompute needed:** `onResultWrite` already keeps `leaderboard/current` current, so standings are read, not recalculated.
  - **New:** a callable export. `onGameClose` is a Firestore trigger on `status → CLOSED`; an admin-initiated send has no document transition to hang off, and the client cannot send directly because `RESEND_API_KEY` is server-only.
  - **Deliberately *not* shared:** any of `closeGame()`'s status handling. Closed games are frozen for everyone, so an interim send must leave the game mid-show and still gradeable. It never touches `status`.
- **Content:** a shorter template than the recap — current leader, top 3 by Pop Count, the sender's own standing, and a line noting the remaining night is still to play. Copy uses **Pop / Drop / Pop Count / Pop Rankings** only.
- Standings are computed from the existing leaderboard document, so no new scoring path is introduced.

## Explicitly out of scope

- **Per-night lock times** — see above; a re-architecture, not an increment.
- **Per-night leaderboards or Pop Counts.** One game, one board.
- **Custom night labels.** Auto-derived `NIGHT n` only.
- **Collapsible night sections.** Revisit only if scroll length proves to be a real problem.
- **Moving a question between nights after publish** — there is still no edit-game flow (see story #9).
- Automatic or scheduled interim emails.

## Risks

| Risk | Mitigation |
|---|---|
| Grouping logic duplicated across five surfaces and drifting | One shared `questionsByDay()` helper; no surface implements its own grouping |
| Existing games lack `dayCount` / `day` | Both default to 1 at normalization; no migration, verified against the two live games |
| Admin mails the pod twice with interim standings | `standingsSentFor` guard on the game document, checked server-side, not just by a disabled button |
| Night count lowered after questions are assigned | Reassign orphaned questions to the new last night; never drop a question |
| Single-night games regress | `dayCount === 1` must render exactly as today — this is the primary regression test |

## Testing

Scoring is untouched, so no scoring behaviour is at risk. Grouping is pure and derived, so `questionsByDay()` is directly testable.

**Manual verification:**

1. Create a **1-night** game — builder shows no night controls; picks screen identical to today. *(Primary regression.)*
2. Open an **existing** game (Night of Champions, no `dayCount`) — renders unchanged.
3. Create a **2-night** game, assign questions to both — picks screen shows `NIGHT 1` and `NIGHT 2` with correct membership.
4. Leave a question unassigned — it appears under Night 1, not dropped.
5. Set nights to 3, assign questions, then lower to 2 — night-3 questions move to night 2.
6. Submit picks on a 2-night game — one submission, whole-game progress, scoring and leaderboard correct.
7. Enter all Night 1 results — interim standings button enables; before that it is disabled.
8. Send interim standings — email arrives, button disables, second send is refused server-side.
9. Close the game — recap email groups results by night; leaderboard unchanged.
