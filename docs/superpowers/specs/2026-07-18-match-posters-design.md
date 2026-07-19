# Match Posters — Design

**Date:** 2026-07-18
**Status:** Approved, ready for implementation plan

## Goal

Let admins attach a **poster image to each Match question** (matches only — not prop bets), set at game-creation time in the Game Builder, and render it on the **Make Picks** screen so each match sells itself visually.

Posters can be supplied two ways — **file upload** or **pasted image URL** — but both end up as an image **re-hosted in our own Firebase Storage bucket**. The app never renders a third-party link.

## Scope decisions

| Question | Decision |
|---|---|
| Which question types get posters? | **Matches only.** Prop bets unchanged. |
| Where does the poster render? | **Make Picks match card only.** Not the live board, admin panel, or results email. |
| When can a poster be set? | **At game creation only.** There is no edit-game flow today and we are not building one. |
| Upload or URL? | **Both**, converging on one field. |
| Does a pasted URL get stored as-is? | **No.** It is fetched server-side and re-hosted, so we carry no dependency on anyone else's CDN. |
| Layout | **Poster left, choices stacked right** on wide screens; collapses to poster-on-top when narrow. (Revised during implementation — see below.) |

### Why re-host rather than store the pasted link

A stored third-party link makes the picks screen permanently dependent on someone else's CDN — subject to hotlink blocking, expiring social-media URLs, and link rot. Re-hosting costs one callable function and removes that class of failure entirely. Accepted trade-off: the URL-ingest path is the most failure-prone piece of this feature, which is precisely why direct upload remains available as a fallback.

## Current state

- `src/types.ts` — `Match { id, name, options }`. No image field anywhere in the model.
- `src/pages/admin/GameBuilder.tsx` (242 lines) — create-only. A shared `QuestionBuilder` component renders **both** matches and prop bets from a common `DraftQuestion { id, label, options }`.
- `src/pages/user/MakePicks.tsx` — renders each match as a `Card` with a label row and either a `VS` pick row (2 options) or a stacked list (3+).
- `src/lib/store.ts` — has `createGame`, no `updateGame`. No route or UI for editing a published game.
- **Firebase Storage is not set up.** No `storage.rules`, no `storage` block in `firebase.json`.
- Functions: `onResultWrite`, `onGameClose` (us-west1, nodejs22, gen 2).

## Design

### 1. Data model

`Match` gains a single optional field:

```ts
export interface Match {
  id: string;
  name: string;
  options: string[];
  /** Firebase Storage download URL for the match poster. Never a third-party link. */
  posterUrl?: string;
}
```

Nothing else changes. `PropBet`, `Submission`, `Results`, and `LeaderboardEntry` are untouched, so **`src/lib/scoring.ts` and `functions/src/scoring.ts` both stay unmodified** and remain in sync.

### 2. Firebase Storage

New `storage.rules`, plus a `storage` block in `firebase.json`.

**Path:** `posters/{uid}/{imageId}.jpg`

Deliberately *not* keyed by game id — posters are chosen in the builder before the game document exists.

**Rules:**

- **read**: any signed-in user (posters render on the picks screen).
- **write**: admin or superadmin only, resolved the same way Firestore rules do it —
  `firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role in ['admin','superadmin']`
- **write** additionally requires `request.resource.contentType.matches('image/.*')` and `request.resource.size < 5 * 1024 * 1024`. These are enforced in the rule, not merely client-side.

### 3. Ingest path A — direct upload (client only)

New module `src/lib/posters.ts` keeps this logic out of `GameBuilder`:

1. Validate the picked file is an image and under the size cap.
2. Downscale through a `<canvas>` to **max 1200px wide**, re-encode as JPEG (~0.85 quality). Prevents multi-MB phone images from dragging the picks screen.
3. `uploadBytes` to `posters/{uid}/{imageId}.jpg`.
4. `getDownloadURL` → assign to the draft match's `posterUrl`.

### 4. Ingest path B — paste URL (callable function)

New `functions/src/posters.ts`, exported from `functions/src/index.ts` as callable **`ingestPosterFromUrl({ url })`**, region us-west1.

1. **Authorize** — reject unless the caller's `/users/{uid}` role is `admin` or `superadmin`.
2. **Validate the URL** — `https:`/`http:` only.
3. **SSRF guard** — resolve the host and reject private, loopback, and link-local ranges. Follow redirects manually with a small cap, re-checking the guard on every hop; a redirect into a private range is rejected.
4. **Fetch** — with a request timeout and a hard byte cap, aborting the stream if exceeded.
5. **Verify** — the response content type is genuinely `image/*`.
6. **Normalize** — `sharp` downscale to max 1200px wide, encode JPEG.
7. **Store** — write to `posters/{uid}/{imageId}.jpg` via the Admin SDK; return the download URL.

Returns a typed error the builder can surface per match (unreachable, not an image, too large, blocked).

### 5. Game Builder UI

`QuestionBuilder` is shared by matches and prop bets, so it takes a new **`withPoster?: boolean`** prop, passed only for the matches instance. `DraftQuestion` gains `posterUrl?: string`.

- **No poster yet** — two controls: `Upload image` (file input) and a paste field + `Add`. Per-match busy and error state; both controls disabled while either is in flight.
- **Poster set** — 16:9 preview thumbnail with `Replace` / `Remove`.

The preview is functional, not decorative: it is where the admin sees the **actual 16:9 crop** before publishing and can swap the image if the crop is bad.

`publish()`'s `cleanQuestions` carries `posterUrl` through for matches, omitting the field when unset so no `undefined` reaches Firestore.

### 6. Make Picks render

> **Revised during implementation.** The original design put the poster in a full-bleed banner above the label. Built and driven in a browser, that turned out badly on desktop: the match card spans the full content width, so a strict 16:9 banner rendered ~750px tall. Capping the height fixed the height but cropped ~57% of the image — and real WWE key art carries the event logo and broadcast details at the top and bottom edges, which is exactly what got cut. The layout below solves both.

When `m.posterUrl` is set, the card splits (class `.poster-split` in `index.css`):

- **≥1100px** — poster column pinned at 620px, choices column takes the rest. Without the pin the poster keeps growing with the viewport (~540px tall at 1920px).
- **640–1099px** — `3fr / 2fr`, poster leading.
- **<640px** — single column: full-bleed 16:9 poster on top, choices beneath.

In the split, choices are centred in their column and capped at **270px** wide so the poster stays the dominant element. Two-competitor matches **stack vertically with the VS between them** rather than sitting side by side — there isn't width for the side-by-side row next to the art. Three-or-more-option matches already stacked, so they're unchanged.

The image is `object-fit: cover` at 16:9, `loading="lazy"`, `alt` = match name, and the card needs `overflow: hidden` to respect its 14px radius.

When `posterUrl` is absent the card renders **exactly as it does today**, including the side-by-side VS row. Posters are optional per match, so a list routinely mixes both.

Measured: 620×349 poster and a 349px card at both 1280px and 1920px; 325×183 at 375px. A four-option match fits the same 349px, so the choices never outgrow the art in practice.

### 7. Demo mode

When `isFirebaseConfigured === false` there is no Storage and no Functions. Both controls render disabled with a short explanatory note. One mock match in `src/data/mock.ts` gets a `posterUrl` so the render path stays demoable.

## Explicitly out of scope

- **Orphan cleanup.** Upload a poster, then delete the match, and the file lingers in Storage. At pod scale this is pennies; a cleanup function is unjustified complexity.
- Posters on the live board, admin live control panel, or results email.
- Editing posters after publish (follows from creation-only).
- Prop-bet posters.
- Admin-chosen crop or focal point.

## Risks

| Risk | Mitigation |
|---|---|
| Storage must be enabled in the Firebase console before `firebase deploy --only storage` succeeds | Manual one-time step, called out in the plan |
| `sharp` is a new functions dependency | Standard, well-supported on nodejs22 gen-2 |
| Some sites block server-side fetches, so URL ingest fails | Upload path remains as the fallback; error surfaces per match |
| Server-side fetch of a user-supplied URL is an SSRF vector | Explicit scheme + private-range guard, re-checked across redirects; admin-only caller |
| A tall/portrait poster crops badly at 16:9 | Builder preview shows the real crop pre-publish |

## Testing

Scoring is untouched, so no scoring behavior is at risk.

**Manual verification:**

1. Publish a game with **no** posters — picks screen identical to today (regression).
2. Publish with posters on **some** matches — mixed card list renders cleanly.
3. Upload a large (>4 MB) phone photo — downscaled, uploads, renders.
4. Upload an oversized/non-image file — rejected with a clear per-match error.
5. Paste a valid WWE.com image URL — re-hosted, and the stored `posterUrl` points at **our** bucket.
6. Paste a URL that 404s, and one that returns an HTML page — both produce a clear error, no crash.
7. Paste a private-range URL (e.g. `http://169.254.169.254/...`) — rejected by the SSRF guard.
8. Paste a portrait poster — confirm the builder preview shows the same crop the picks screen does.
9. Demo mode (`isFirebaseConfigured` false) — controls disabled with explanation, mock poster still renders.
