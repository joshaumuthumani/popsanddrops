# Pops & Drops

A real-time pro-wrestling prediction game for the **CodWrestlePod** community.

## About

Before a wrestling card airs, the pod's admins publish a **challenge**: the night's matches plus a
handful of prop bets. Members pick every winner before the show starts, and picks freeze the moment
the countdown hits zero. As the show runs, an admin enters each result live and everyone's board
updates within seconds — a correct call is a **Pop**, a miss is a **Drop**. When the card ends the
game closes, a tiebreaker settles ties, and every player gets an emailed recap of the final
standings.

The whole app is **pod-wide** by design. Games belong to the community, not to whoever created
them: any admin can run any game, and every member sees the pod's live game and latest result.

## Features

- **Make Picks** — pick every match and prop bet before lock, with a live countdown and progress bar. Matches can carry a poster image.
- **Pop Rankings** — the live leaderboard, updating as results come in mid-show
- **Game Builder** — admins compose a card (matches, prop bets, tiebreaker, lock time) and publish it
- **Live control** — admins enter results as the show airs
- **Close & recap** — closing a game applies the tiebreaker and emails final standings to every player
- **Join by code** — members join a challenge with a short shareable code
- **Roles** — User / Admin / Super Admin, with admin management for the Super Admin

## Tech Stack

| Layer | Tooling |
| --- | --- |
| Framework | React 18 · Vite · TypeScript |
| Styling | Tailwind CSS v4 (`@theme` tokens in `src/index.css`) |
| Routing | React Router v6 |
| Auth | Firebase Auth (Google sign-in) |
| Database | Cloud Firestore |
| Files | Cloud Storage (match posters) |
| Backend | Cloud Functions (2nd gen, nodejs22, us-west1) |
| Email | Resend |
| Hosting | Firebase Hosting — [popsanddrops.us](https://popsanddrops.us) |

## Getting Started

### Prerequisites

- Node.js 20+
- A Firebase project on the Blaze plan (only needed to run against a live backend)

### Setup

```bash
git clone https://github.com/joshaumuthumani/popsanddrops.git
cd popsanddrops
npm install
cp .env.example .env   # fill in your Firebase web config
npm run dev
```

**With no keys set, the app boots in demo mode** on mock data — sign-in is mocked and you can walk
every screen without a backend. Fill in `.env` and it switches to live Google Auth + Firestore
automatically. Full backend wiring instructions live in [SETUP.md](SETUP.md).

## Environment Variables

| File | Key | Required | Purpose |
| --- | --- | --- | --- |
| `.env` | `VITE_FIREBASE_API_KEY` | Yes | Firebase web config (client-safe; security is enforced by rules) |
| `.env` | `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Must be `popsanddrops.us`, not the default `firebaseapp.com` — otherwise Safari's ITP hangs sign-in |
| `.env` | `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project id |
| `.env` | `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Storage bucket — match posters live here |
| `.env` | `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase web config |
| `.env` | `VITE_FIREBASE_APP_ID` | Yes | Firebase web config |
| `functions/.env` | `RESEND_API_KEY` | For email | Send-only Resend key |
| `functions/.env` | `RESEND_FROM` | For email | Sender identity, e.g. `Pops & Drops <noreply@popsanddrops.us>` |
| `functions/.env` | `APP_PUBLIC_URL` | For email | Base URL used in result-email links |

> **Never commit real secrets.** Both `.env` files are gitignored; tracked examples are
> `.env.example` and `functions/.env.example`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck (`tsc -b`) and produce a production build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm run build --prefix functions` | Compile Cloud Functions |

## Project Structure

```
popsanddrops/
├── src/
│   ├── components/   reusable UI (header, pick button, leaderboard, poster picker…)
│   ├── context/      AuthContext — Google auth + role, mock-aware in demo mode
│   ├── pages/        user/* and admin/* screens
│   ├── hooks/        data hooks with mock fallback
│   ├── lib/          firebase init, Firestore access, scoring, poster ingest
│   ├── data/mock.ts  demo-mode data mirroring the Firestore model
│   └── types.ts      domain types mirroring the Firestore model
├── functions/src/    Cloud Functions — scoring, tiebreaker, results email, poster ingest
├── docs/             specs and design docs
├── firestore.rules   Firestore security rules
└── storage.rules     Cloud Storage security rules
```

## Things worth knowing before you change anything

- **`src/lib/scoring.ts` and `functions/src/scoring.ts` are mirrors.** Change one, change the other.
- **The pick lock is enforced by the server clock in Firestore rules**, not by stored status — so a
  forgotten status flip or a manipulated client clock can't reopen submissions.
- **The live leaderboard is computed client-side** from raw submissions plus results. The Cloud
  Function also writes authoritative scores back; that copy is what the recap email uses.
- **The user dashboard's collection-group query needs both** a `COLLECTION_GROUP` index on
  `submissions.uid` and a `resource.data.uid == uid()` branch in the read rule. Removing either
  silently blanks every player's dashboard — it has happened once already.
- **Match posters are always re-hosted in our own bucket.** A pasted link is fetched server-side and
  stored; the app never renders a third-party URL.
- **UI copy uses Pop / Drop / Pop Count / Pop Rankings only** — never "score", "points", or
  "correct". Engineering may use `score` internally.

## Project Board & Workflow

Work is tracked on the **Pops & Drops Board** GitHub Project using a **Feature → Story → Task**
issue hierarchy. Status flows **Todo → In Progress → Done**; commits and PRs reference issues
(`Fixes #12`) so they auto-close on merge.

See [GitHub-Project-Setup.md](GitHub-Project-Setup.md) for the full board setup and
[CLAUDE.md](CLAUDE.md) for contributor and agent rules.

## Deployment

Everything ships to Firebase from one project:

```bash
npm run build
firebase deploy                      # hosting + rules + functions
firebase deploy --only hosting       # or one target at a time
firebase deploy --only firestore:rules
firebase deploy --only storage
firebase deploy --only functions
```

The apex DNS record for `popsanddrops.us` must stay **DNS-only (grey-clouded)** in Cloudflare —
proxying it breaks Firebase SSL provisioning.

## License

Private project — all rights reserved.
