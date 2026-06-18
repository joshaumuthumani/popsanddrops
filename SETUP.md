# Pops & Drops — Setup

A real-time pro-wrestling prediction game for the **CodWrestlePod** community.
React (Vite + TS) · Firebase (Auth · Firestore · Functions) · Resend email.

## Run it now (no keys needed — Phase 0 demo)

```bash
npm install
npm run dev
```

The app boots in **demo mode** on mock data (the "AEW All In 2026" card from the design).
"Sign in with Google" signs you in as a mock Super Admin so you can walk every screen:

- **User app** — `/app` (your challenges) → a game → **Make Picks** / **Pop Rankings**
- **Admin console** — `/admin` (all games) → a game → **Dashboard** / **Live control**,
  plus **Create new game** (`/admin/new`), **Close game**, and **Manage admins** (`/admin/manage`)
- **Join by code** — `/join/SLAM-4827`

A demo role switch in the header lets you preview the plain-User experience.

## Wire the real backend (Phase 1 + 2)

Copy `.env.example` → `.env` and fill in your Firebase Web App config. The app detects the
keys and automatically switches from mock data to live Google Auth + Firestore.

### What you need to provide

| # | Item | Where |
|---|------|-------|
| 1 | **Firebase Web config** (`VITE_FIREBASE_*`) | Firebase Console → Project settings → Your apps → Web app |
| 2 | **Enable Google Sign-In** | Authentication → Sign-in method → Google → Enable (+ add authorized domains) |
| 3 | **Enable Cloud Firestore** | Firestore Database → Create (production mode) |
| 4 | **Blaze plan** | Required for Cloud Functions to call Resend |
| 5 | **Super Admin email** | Your Google account — bootstrapped to `role: superadmin` |
| 6 | **Resend API key** (Phase 2) | resend.com → API keys (`RESEND_API_KEY`) + sender domain |
| 7 | **Hosting domain** (Phase 2) | Firebase Hosting or Vercel — used in result-email links |

Secrets (`RESEND_API_KEY`, service-account JSON) live in Functions config / `.env` and are
**never committed** (see `.gitignore`).

## Project layout

```
src/
  components/   reusable UI (header, pick button, leaderboard, countdown, primitives…)
  context/      AuthContext — Google auth + role (mock-aware until Firebase is connected)
  pages/        user/* and admin/* screens
  data/mock.ts  Phase 0 mock data mirroring the Firestore model
  lib/          firebase init (guarded), formatters
  types.ts      domain types mirroring the Firestore data model (PRD §7)
```

## Design language

Dark navy/black with gold/cyan/red accents pulled from the CodWrestlePod logo; Bebas Neue
display + Inter body. Tokens live in `src/index.css` (`@theme`). UI copy uses **Pop / Drop /
Pop Count / Pop Rankings** only — never "score/points/correct" (PRD §3).
