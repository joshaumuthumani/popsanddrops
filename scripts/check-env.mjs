/**
 * Build-time env guard. Wired as `prebuild`, and `firebase.json`'s hosting `predeploy` runs
 * `npm run build` — so a plain `firebase deploy` fails loudly rather than shipping a broken
 * auth config from a stale `dist/`.
 *
 * Why this exists: VITE_FIREBASE_AUTH_DOMAIN was set to the default
 * `popsanddrops.firebaseapp.com` for ~3 weeks. Every deploy in that window shipped it, and
 * Safari sign-in was broken in production the whole time — silently, because a wrong value
 * builds and deploys perfectly happily. `.env` is gitignored, so nothing in the repo could
 * catch it. This can.
 *
 * Env resolution is delegated to Vite's own `loadEnv` rather than hand-parsed. That matters:
 * `vite build` runs in mode `production` and loads `.env.production[.local]` at HIGHER
 * precedence than `.env`. A hand-rolled parser reading only `.env` would report "OK" while
 * the build shipped a bad value from `.env.production` — the exact outage this guards against.
 * Using loadEnv also gets dotenv's quote-stripping and `export KEY=` handling for free.
 *
 * Demo mode (no Firebase keys) is a legitimate configuration and is left alone.
 */
import { loadEnv } from 'vite';

const REQUIRED_AUTH_DOMAIN = 'popsanddrops.us';

// Mode 'production' matches `vite build`'s default, so this resolves exactly what the build
// will see — same files, same precedence, same process.env overlay.
const env = loadEnv('production', process.cwd(), 'VITE_');

const { VITE_FIREBASE_API_KEY: apiKey, VITE_FIREBASE_PROJECT_ID: projectId } = env;
const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;

// Mirrors src/lib/firebase.ts: Firebase is "configured" only with both of these.
if (!apiKey || !projectId) {
  console.log('[check-env] No Firebase keys — building in demo mode. Skipping auth-domain check.');
  process.exit(0);
}

if (authDomain !== REQUIRED_AUTH_DOMAIN) {
  console.error(
    `\n[check-env] BUILD BLOCKED — VITE_FIREBASE_AUTH_DOMAIN is "${authDomain ?? '(unset)'}".\n` +
      `It must be "${REQUIRED_AUTH_DOMAIN}".\n\n` +
      `The default "*.firebaseapp.com" builds and deploys fine but breaks sign-in in\n` +
      `production (Safari's ITP hangs it). Fix the value in .env (or .env.production),\n` +
      `then rebuild.\n` +
      `See README.md ("Environment") and CLAUDE.md ("Deploying").\n`,
  );
  process.exit(1);
}

console.log(`[check-env] auth domain OK (${authDomain}).`);
