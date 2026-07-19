# CLAUDE.md — rules of the road

Guidance for any agent or contributor working in this repo. Read
[README.md](README.md) first for what the project is; this file covers how we work in it.

## The app is pod-wide

This is the single most important thing to understand, and the easiest to get wrong.

**Games belong to the whole pod, not to whoever created them.** Access is by *global role*, never by
per-game membership:

- **Any admin** (`admin` or `superadmin`) can run **any** game — view all games, create, enter live
  results, see player submissions, and close.
- **Super Admin only:** manage admins (assign/revoke roles) and delete games.
- `createdBy` is a display-only "Organizer" label. It grants nothing.
- The per-game `admins` array is **vestigial** and must not gate access.

If you find yourself filtering games or actions by creator or per-game membership, that's a bug. An
earlier model did exactly that, and a freshly promoted admin saw an empty console as a result.

## Invariants — don't break these

- **`src/lib/scoring.ts` and `functions/src/scoring.ts` are mirrors.** Change one, change the other.
- **The pick lock is enforced by the server clock in rules** (`request.time.toMillis() >= lockTime`),
  not by stored status. Don't replace it with a status check.
- **The dashboard's collection-group query needs two things**: a `COLLECTION_GROUP` index on
  `submissions.uid` in `firestore.indexes.json`, *and* a `resource.data.uid == uid()` branch in the
  submissions read rule. A doc-id match alone does **not** authorize a field-filtered
  collection-group query. Removing either silently blanks every player's dashboard.
- **Match posters are always re-hosted in our own Storage bucket.** Never persist a third-party URL
  into `Match.posterUrl`.
- **Closed games are frozen** for everyone.
- **Never commit secrets.** `.env` (Vite/client) and `functions/.env` (server) are both gitignored.

## Copy rules

User-facing copy uses **Pop / Drop / Pop Count / Pop Rankings** only — never "score", "points", or
"correct". Internal code may use `score` as a variable name.

## Design language

Dark navy/black with gold, cyan, and red accents drawn from the CodWrestlePod logo. Bebas Neue for
display, Inter for body. Tokens live in `src/index.css` under `@theme` — use them rather than
hardcoding new colors.

Anything user-facing should target **WCAG 2.1 AA**.

## Demo mode is a real mode

With no Firebase keys set, `isFirebaseConfigured` is false and the app runs on mock data with mocked
sign-in. Any new feature that depends on a backend service must **degrade visibly** in demo mode —
disabled controls with a short explanation, not a crash or a dead button.

## Work tracking

Every change maps to a GitHub issue on the **Pops & Drops Board**.

- Exactly **one** `type:` label per issue: `type: feature` / `type: story` / `type: task` /
  `type: bug`.
- Hierarchy via native sub-issues: **Feature → Story → Task**. Titles are prefixed `feat:` /
  `story:` / `task:` / `bug:`.
- Don't pre-create Tasks. Break Stories into Tasks during the coding session and link them then.
- Add every issue to the board with Status = **Todo**; move to **In Progress** when you start.
- Reference the issue in commits and PRs (`Fixes #12`) so it links and auto-closes on merge.

Full setup recipe: [GitHub-Project-Setup.md](GitHub-Project-Setup.md).

## Process

- **Brainstorm before building.** Non-trivial features get a design discussion, then a spec in
  `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, committed before implementation starts.
- **Verify before claiming done.** Run the app and drive the actual flow — a passing typecheck is
  not evidence a feature works. State plainly what you verified and what you didn't; an unverified
  path is a finding, not something to paper over.
- **Security-check before opening a PR**, especially anything touching rules, auth, or a server-side
  fetch of user-supplied input.

## Deploying

```bash
npm run build && firebase deploy
```

Region is **us-west1** and permanent (pinned at Firestore creation). `VITE_FIREBASE_AUTH_DOMAIN`
must stay `popsanddrops.us` — reverting it to `firebaseapp.com` breaks Safari sign-in. The apex DNS
record must stay grey-clouded (DNS-only) in Cloudflare or Firebase SSL provisioning breaks.

New Firebase products need enabling in the console before their first `firebase deploy` will work.
