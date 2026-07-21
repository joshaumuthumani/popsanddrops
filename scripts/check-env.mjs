/**
 * Build-time env guard. Runs as `prebuild`, so `npm run build` (and therefore every
 * `firebase deploy`) fails loudly rather than shipping a broken auth config.
 *
 * Why this exists: VITE_FIREBASE_AUTH_DOMAIN was set to the default
 * `popsanddrops.firebaseapp.com` for ~3 weeks. Every deploy in that window shipped it, and
 * Safari sign-in was broken in production the whole time — silently, because a wrong value
 * builds and deploys perfectly happily. `.env` is gitignored, so nothing in the repo could
 * catch it. This can.
 *
 * Demo mode (no Firebase keys) is a legitimate configuration and is left alone.
 */
import { readFileSync, existsSync } from 'node:fs';

const REQUIRED_AUTH_DOMAIN = 'popsanddrops.us';

/** Minimal .env parser — enough for KEY=value lines, ignoring comments and blanks. */
function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

// Vite precedence: .env.local overrides .env; real process env overrides both (CI).
const env = { ...parseEnvFile('.env'), ...parseEnvFile('.env.local'), ...process.env };

const apiKey = env.VITE_FIREBASE_API_KEY;
const projectId = env.VITE_FIREBASE_PROJECT_ID;
const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;

// Mirrors src/lib/firebase.ts: Firebase is "configured" only with both of these.
const isFirebaseConfigured = Boolean(apiKey && projectId);

if (!isFirebaseConfigured) {
  console.log('[check-env] No Firebase keys — building in demo mode. Skipping auth-domain check.');
  process.exit(0);
}

if (authDomain !== REQUIRED_AUTH_DOMAIN) {
  console.error(
    `\n[check-env] BUILD BLOCKED — VITE_FIREBASE_AUTH_DOMAIN is "${authDomain ?? '(unset)'}".\n` +
      `It must be "${REQUIRED_AUTH_DOMAIN}".\n\n` +
      `The default "*.firebaseapp.com" builds and deploys fine but breaks sign-in in\n` +
      `production (Safari's ITP hangs it). Fix the value in .env, then rebuild.\n` +
      `See README.md ("Environment") and CLAUDE.md ("Deploying").\n`,
  );
  process.exit(1);
}

console.log(`[check-env] auth domain OK (${authDomain}).`);
