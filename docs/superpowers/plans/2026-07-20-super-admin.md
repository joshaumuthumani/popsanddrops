# Super Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Super Admins two capabilities — edit a live (`OPEN`) game, and hard-delete any game — without letting an edit silently orphan players' picks.

**Architecture:** Editing is a client-side `updateGame` write, gated at the Firestore-rules layer so only a `superadmin` may change structural fields (a plain admin may still only *close*). The pick-orphan hazard is handled by pure functions (`src/lib/pickIntegrity.ts`) reused for both the admin's pre-save warning and the player's "re-pick" flag. Deleting is a Super-Admin-only Admin-SDK `recursiveDelete` callable, because the client cannot delete `submissions`.

**Tech Stack:** React 18 + Vite + TS, Firebase (Firestore, Cloud Functions v2 `onCall`, `firebase-admin ^12`), Firestore security rules (`rules_version = '2'`), Vitest (jsdom unit + `@firebase/rules-unit-testing` emulator e2e).

## Global Constraints

- **Region `us-west1`** for any Cloud Function; `initializeApp()` + `setGlobalOptions({region:'us-west1'})` already set in `functions/src/index.ts`.
- **Copy rule:** user-facing text uses **Pop / Drop / Pop Count / Pop Rankings** only — never "score/points/correct". `score` is allowed as an internal identifier.
- **`src/lib/scoring.ts` and `functions/src/scoring.ts` stay mirrored** — this feature does not touch scoring; do not edit either.
- **Closed games are frozen** — editing is `OPEN`-only; do not loosen the `status != 'CLOSED'` guard.
- **Posters** are always re-hosted in our bucket — reuse `PosterPicker`; never persist a third-party URL into `Match.posterUrl`.
- **Demo mode** (`isFirebaseConfigured === false`): new controls degrade visibly (disabled + explanation), never a dead button or crash.
- **Super-Admin gate** in UI is `user.role === 'superadmin'` (matches `AdminManagement`); enforcement is in rules (edit) and the callable (delete).
- **Rules-unit tests** run via `npm run test:e2e` with `PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"` (JDK 21 emulator). Unit tests via `npm test`.
- Every logic commit ships with its tests. After the feature, update `TOKEN_LOG.md`.

---

### Task 1: Tighten the game-update rule (Super-Admin structural edit)

Makes "only a Super Admin may edit a published game's structure" true at the trust boundary, while any admin can still close. This is the highest-risk change (the bug-prone rules layer) so it goes first and test-first.

**Files:**
- Modify: `firestore.rules` (the `games/{gameId}` `allow update` line)
- Test: `tests/e2e/rules.test.ts` (add cases to the existing `describe('the shared-admin model')` or a new `describe`)

**Interfaces:**
- Produces: the invariant that `games/{gameId}` structural updates require `isSuperAdmin()`; consumed by Task 2's `updateGame` at runtime.

- [ ] **Step 1: Write the failing tests.** Add to `tests/e2e/rules.test.ts`:

```ts
describe('editing a live game is super-admin-only', () => {
  it('lets any admin close a game (status + tiebreaker only)', async () => {
    const db = asAdmin();
    await assertSucceeds(
      setDoc(doc(db, 'games/openGame'), { status: 'CLOSED', tiebreakerAnswer: '12' }, { merge: true }),
    );
  });

  it('refuses a plain admin changing a structural field (matches)', async () => {
    const db = asAdmin();
    await assertFails(
      setDoc(doc(db, 'games/openGame'), { matches: [{ id: 'm1', name: 'X', options: ['a', 'b'] }] }, { merge: true }),
    );
  });

  it('lets a super admin change a structural field on an OPEN game', async () => {
    const db = asSuper();
    await assertSucceeds(
      setDoc(doc(db, 'games/openGame'), { matches: [{ id: 'm1', name: 'X', options: ['a', 'b'] }], lockTime: LOCK_TIME }, { merge: true }),
    );
  });

  it('refuses even a super admin editing a CLOSED game', async () => {
    const db = asSuper();
    await assertFails(
      setDoc(doc(db, 'games/closedGame'), { matches: [{ id: 'm1', name: 'X', options: ['a', 'b'] }] }, { merge: true }),
    );
  });
});
```

- [ ] **Step 2: Run to verify they fail.**

Run: `PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" npm run test:e2e`
Expected: the "refuses a plain admin changing a structural field" case FAILS (today's rule allows any admin to change any field), proving the gap.

- [ ] **Step 3: Tighten the rule.** In `firestore.rules`, replace the `games/{gameId}` update rule:

```
      // Any admin may CLOSE a game (status + tiebreakerAnswer only). Broader, structural
      // edits (matches, props, lockTime, name…) are a Super-Admin-only action. A CLOSED
      // game is frozen for everyone. `standingsSentFor` is written by the sendNightStandings
      // callable via the Admin SDK (bypasses these rules), so it isn't listed here.
      allow update: if resource.data.status != 'CLOSED'
                    && (
                      isSuperAdmin()
                      || (isAdmin()
                          && request.resource.data.diff(resource.data)
                               .affectedKeys().hasOnly(['status', 'tiebreakerAnswer']))
                    );
```

- [ ] **Step 4: Run to verify all rules tests pass.**

Run: `PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" npm run test:e2e`
Expected: PASS (all existing + 4 new). Confirm the existing "lets any admin edit a game they did not create" (a `{status:'LOCKED'}` merge) still passes — `affectedKeys` is `{status}`, within `hasOnly`.

- [ ] **Step 5: Commit.**

```bash
git add firestore.rules tests/e2e/rules.test.ts
git commit -m "feat(rules): restrict structural game edits to super admins (#22)"
```

---

### Task 2: `updateGame` store function + pure `gameUpdateFields`

**Files:**
- Modify: `src/lib/store.ts` (add after `createGame`)
- Test: `src/lib/store.test.ts` (new; unit-tests the pure helper only)

**Interfaces:**
- Consumes: existing `NewGameInput`, `reqDb`, `doc`, `updateDoc` (all already imported in `store.ts`).
- Produces: `gameUpdateFields(input: NewGameInput): Record<string, unknown>` and `updateGame(gameId: string, input: NewGameInput): Promise<void>` — consumed by Task 5 (`EditGame`).

- [ ] **Step 1: Write the failing test.** Create `src/lib/store.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { gameUpdateFields, type NewGameInput } from './store';

const input: NewGameInput = {
  name: '  Slam  ', promotion: '  WWE ', eventDate: '2026-08-01',
  lockTime: 1000, dayCount: 0,
  matches: [{ id: 'm1', name: 'Main', options: ['A', 'B'] }],
  propBets: [{ id: 'p1', question: 'Run-in?', options: ['Yes', 'No'] }],
  tiebreakerQuestion: '  How long?  ',
};

describe('gameUpdateFields', () => {
  it('writes only editable fields, trimmed', () => {
    const out = gameUpdateFields(input);
    expect(out).toEqual({
      name: 'Slam', promotion: 'WWE', eventDate: '2026-08-01',
      lockTime: 1000, dayCount: 1,
      matches: input.matches, propBets: input.propBets,
      tiebreakerQuestion: 'How long?',
    });
  });

  it('never includes identity or lifecycle fields', () => {
    const keys = Object.keys(gameUpdateFields(input));
    for (const forbidden of ['status', 'createdBy', 'admins', 'joinCode', 'createdAt', 'tiebreakerAnswer', 'standingsSentFor']) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `npm test -- store.test`
Expected: FAIL — `gameUpdateFields` is not exported.

- [ ] **Step 3: Implement.** In `src/lib/store.ts`, immediately after `createGame`:

```ts
/**
 * The subset of a game an edit may change. Deliberately excludes identity and lifecycle
 * fields (status/createdBy/admins/joinCode/createdAt/tiebreakerAnswer/standingsSentFor):
 * status transitions belong to closeGame, and the rest are set once at creation.
 */
export function gameUpdateFields(input: NewGameInput) {
  return {
    name: input.name.trim(),
    promotion: input.promotion.trim(),
    eventDate: input.eventDate,
    lockTime: input.lockTime,
    dayCount: Math.max(1, input.dayCount || 1),
    matches: input.matches,
    propBets: input.propBets,
    tiebreakerQuestion: input.tiebreakerQuestion.trim(),
  };
}

/** Super-Admin edit of a live game. Rules enforce the super-admin + non-CLOSED gate. */
export async function updateGame(gameId: string, input: NewGameInput): Promise<void> {
  await updateDoc(doc(reqDb(), 'games', gameId), gameUpdateFields(input));
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `npm test -- store.test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/store.ts src/lib/store.test.ts
git commit -m "feat: updateGame store fn + pure gameUpdateFields (#22)"
```

---

### Task 3: Pick-integrity pure functions

The shared engine for both the admin warning and the player flag. All pure, fully unit-tested.

**Files:**
- Create: `src/lib/pickIntegrity.ts`
- Test: `src/lib/pickIntegrity.test.ts`

**Interfaces:**
- Consumes: `Game`, `Submission` types.
- Produces:
  - `gameQuestions(game): QuestionOptions[]`
  - `orphanedPickIds(questions, picks): string[]`
  - `unansweredQuestionIds(questions, picks): string[]`
  - `orphanImpact(questions, submissions): OrphanImpact`
  - `submissionPicks(sub): Record<string,string>`
  — all consumed by Tasks 6 and 7.

- [ ] **Step 1: Write the failing tests.** Create `src/lib/pickIntegrity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  gameQuestions, orphanedPickIds, unansweredQuestionIds, orphanImpact, submissionPicks,
} from './pickIntegrity';

const questions = [
  { id: 'm1', options: ['Roman', 'Seth'] },
  { id: 'p1', options: ['Yes', 'No'] },
];

describe('orphanedPickIds', () => {
  it('flags a pick whose option was removed/renamed', () => {
    expect(orphanedPickIds(questions, { m1: 'Cody' })).toEqual(['m1']);
  });
  it('flags a pick for a question that no longer exists', () => {
    expect(orphanedPickIds(questions, { gone: 'Roman' })).toEqual(['gone']);
  });
  it('ignores valid picks and empty picks', () => {
    expect(orphanedPickIds(questions, { m1: 'Roman', p1: '' })).toEqual([]);
  });
});

describe('unansweredQuestionIds', () => {
  it('lists questions with no non-empty pick', () => {
    expect(unansweredQuestionIds(questions, { m1: 'Roman' }).sort()).toEqual(['p1']);
  });
});

describe('orphanImpact', () => {
  it('counts affected submissions and per-option tallies', () => {
    const subs = [
      { matchPicks: { m1: 'Cody' }, propBetPicks: {} },
      { matchPicks: { m1: 'Cody' }, propBetPicks: {} },
      { matchPicks: { m1: 'Roman' }, propBetPicks: {} },
    ];
    const impact = orphanImpact(questions, subs);
    expect(impact.totalAffected).toBe(2);
    expect(impact.byOption).toEqual([{ questionId: 'm1', option: 'Cody', count: 2 }]);
  });
});

describe('gameQuestions / submissionPicks', () => {
  it('flattens matches+props and merges pick maps', () => {
    const game = {
      matches: [{ id: 'm1', name: 'A', options: ['Roman', 'Seth'] }],
      propBets: [{ id: 'p1', question: 'Q', options: ['Yes', 'No'] }],
    };
    expect(gameQuestions(game as never)).toEqual(questions);
    expect(submissionPicks({ matchPicks: { m1: 'Roman' }, propBetPicks: { p1: 'No' } })).toEqual({ m1: 'Roman', p1: 'No' });
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `npm test -- pickIntegrity`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.** Create `src/lib/pickIntegrity.ts`:

```ts
import type { Game, Submission } from '@/types';

/** A question reduced to what pick-integrity needs: its id and current options. */
export interface QuestionOptions {
  id: string;
  options: string[];
}

/** Impact of a pending edit on already-submitted picks. */
export interface OrphanImpact {
  /** Distinct submissions with at least one orphaned pick. */
  totalAffected: number;
  /** Per (question, chosen option) tally, for a human-readable warning. */
  byOption: { questionId: string; option: string; count: number }[];
}

/** All gradeable questions of a game (matches then prop bets) as {id, options}. */
export function gameQuestions(game: Pick<Game, 'matches' | 'propBets'>): QuestionOptions[] {
  return [
    ...game.matches.map((m) => ({ id: m.id, options: m.options })),
    ...game.propBets.map((p) => ({ id: p.id, options: p.options })),
  ];
}

/** matchPicks + propBetPicks merged into one id->option map (ids are unique across both). */
export function submissionPicks(sub: Pick<Submission, 'matchPicks' | 'propBetPicks'>): Record<string, string> {
  return { ...sub.matchPicks, ...sub.propBetPicks };
}

/**
 * Question ids whose saved pick is orphaned: a non-empty pick for a question that no longer
 * exists, or whose chosen option is no longer offered. Scoring matches the saved option
 * STRING, so an orphaned pick can never score again — this is the core edit hazard.
 */
export function orphanedPickIds(questions: QuestionOptions[], picks: Record<string, string>): string[] {
  const byId = new Map(questions.map((q) => [q.id, q.options]));
  return Object.entries(picks)
    .filter(([id, choice]) => {
      if (!choice) return false;
      const options = byId.get(id);
      if (!options) return true;
      return !options.includes(choice);
    })
    .map(([id]) => id);
}

/** Current question ids the player hasn't answered (added after they submitted, or skipped). */
export function unansweredQuestionIds(questions: QuestionOptions[], picks: Record<string, string>): string[] {
  return questions.filter((q) => !picks[q.id]).map((q) => q.id);
}

/**
 * Aggregate orphan impact of a pending edit: pass the DRAFT (edited) questions and the game's
 * existing submissions. Powers the admin's pre-save confirmation.
 */
export function orphanImpact(
  questions: QuestionOptions[],
  submissions: Pick<Submission, 'matchPicks' | 'propBetPicks'>[],
): OrphanImpact {
  const SEP = ' ';
  const counts = new Map<string, number>();
  let totalAffected = 0;
  for (const sub of submissions) {
    const picks = submissionPicks(sub);
    const orphans = orphanedPickIds(questions, picks);
    if (orphans.length) totalAffected++;
    for (const qid of orphans) counts.set(`${qid}${SEP}${picks[qid]}`, (counts.get(`${qid}${SEP}${picks[qid]}`) ?? 0) + 1);
  }
  const byOption = [...counts.entries()].map(([key, count]) => {
    const [questionId, option] = key.split(SEP);
    return { questionId, option, count };
  });
  return { totalAffected, byOption };
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `npm test -- pickIntegrity`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/pickIntegrity.ts src/lib/pickIntegrity.test.ts
git commit -m "feat: pick-integrity helpers (orphan + unanswered detection) (#23)"
```

---

### Task 4: Extract `GameForm` from `GameBuilder` (pure refactor)

`GameBuilder` currently owns all form state + validation + the DraftQuestion→domain mapping and calls `createGame` directly. Extract the reusable form so both create and edit share it. **No behavior change** — verified by "create still works".

**Files:**
- Create: `src/pages/admin/GameForm.tsx` (move `DraftQuestion`, `newId`, `labelStyle`, `inputStyle`, `QuestionBuilder`, and the field markup + `publish` validation/build logic here)
- Modify: `src/pages/admin/GameBuilder.tsx` (becomes a thin wrapper that renders `GameForm` with empty initial state and an `onSubmit` that calls `createGame`)

**Interfaces:**
- Produces (consumed by Tasks 5–6):

```ts
export interface GameFormInitial {
  name: string; promotion: string; eventDate: string;
  lockTimeLocal: string;   // value for <input type="datetime-local">
  dayCount: number; tiebreaker: string;
  matches: DraftQuestion[]; props: DraftQuestion[];
}
export interface GameFormProps {
  initial: GameFormInitial;
  submitLabel: string;     // "Publish game" | "Save changes"
  busyLabel: string;       // "Publishing…"  | "Saving…"
  onSubmit: (input: NewGameInput) => Promise<void>;
  onCancel: () => void;
  /** Optional pre-commit gate (edit uses it for the orphan warning). Return false to abort. */
  beforeSubmit?: (input: NewGameInput) => Promise<boolean>;
  disabledInDemo?: boolean; // when true, submit shows a demo-mode note instead of writing
}
export const EMPTY_GAME_FORM: GameFormInitial; // one blank match, Yes/No prop, dayCount 1
export function GameForm(props: GameFormProps): JSX.Element;
export function draftFromGame(game: Game): GameFormInitial; // hydrate edit mode (Task 5)
```

- [ ] **Step 1: Create `GameForm.tsx`.** Move the following from `GameBuilder.tsx` verbatim: `DraftQuestion`, `newId`, `labelStyle`, `inputStyle`, and the entire `QuestionBuilder` function. Then build `GameForm` from `GameBuilder`'s body — same `useState` fields (seed each from `props.initial` instead of `''`/defaults), same `changeDayCount`, `cleanQuestions`, and the `publish` validation. Replace the terminal `createGame(...)` block with:

```ts
    const input: NewGameInput = {
      name, promotion, eventDate, lockTime: lockMs, dayCount,
      tiebreakerQuestion: tiebreaker,
      matches: cleanMatches.map((m) => ({
        id: m.id, name: m.label, options: m.options,
        ...(m.posterUrl ? { posterUrl: m.posterUrl } : {}),
        ...(dayCount > 1 ? { day: m.day ?? 1 } : {}),
      })),
      propBets: cleanProps.map((p) => ({
        id: p.id, question: p.label, options: p.options,
        ...(dayCount > 1 ? { day: p.day ?? 1 } : {}),
      })),
    };
    if (props.beforeSubmit && !(await props.beforeSubmit(input))) return;
    if (props.disabledInDemo || !isFirebaseConfigured) { setToastOpen(true); return; }
    setBusy(true);
    try { await props.onSubmit(input); } catch { setError('Could not save. Please try again.'); }
    finally { setBusy(false); }
```

Use `props.submitLabel`/`props.busyLabel` on the button, `props.onCancel` for Cancel. Keep the `PageTitle` as a `children`/prop or leave it out of `GameForm` (the page supplies its own title). Export `EMPTY_GAME_FORM` and `draftFromGame` (stub `draftFromGame` now; Task 5 uses it).

- [ ] **Step 2: Slim `GameBuilder.tsx`** to a wrapper:

```tsx
export function GameBuilder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [newGameId, setNewGameId] = useState<string | null>(null);
  return (
    <div>
      <div style={{ marginBottom: 22 }}><PageTitle>New Challenge</PageTitle></div>
      <GameForm
        initial={EMPTY_GAME_FORM}
        submitLabel="Publish game" busyLabel="Publishing…"
        onCancel={() => navigate('/admin')}
        onSubmit={async (input) => { if (user) setNewGameId(await createGame(input, user)); }}
      />
      {/* keep the existing success Toast, navigating to newGameId ?? '/admin' */}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + build.**

Run: `npx tsc -b && npm run build`
Expected: PASS, no type errors.

- [ ] **Step 4: Manually verify create is unchanged.** Run the app (`npm run dev`), create a game in demo mode and (if configured) live: fields, night selector, poster paste, validation messages, and publish all behave exactly as before.

- [ ] **Step 5: Commit.**

```bash
git add src/pages/admin/GameForm.tsx src/pages/admin/GameBuilder.tsx
git commit -m "refactor: extract GameForm from GameBuilder (no behavior change) (#22)"
```

---

### Task 5: Edit screen, route, Super-Admin gate, Edit button

**Files:**
- Create: `src/pages/admin/EditGame.tsx`
- Modify: `src/App.tsx` (add route), `src/components/ProtectedRoute.tsx` (add `superAdminOnly`), `src/pages/admin/AdminGame.tsx` (Edit button)
- Implement: `draftFromGame` in `GameForm.tsx`

**Interfaces:**
- Consumes: `GameForm`, `draftFromGame`, `updateGame` (Task 2), `useGame`.
- Produces: route `/admin/game/:gameId/edit`; `ProtectedRoute` prop `superAdminOnly?: boolean`.

- [ ] **Step 1: Implement `draftFromGame`** in `GameForm.tsx`:

```ts
export function draftFromGame(game: Game): GameFormInitial {
  const toDraft = (q: { id: string; options: string[]; day?: number }, label: string, posterUrl?: string): DraftQuestion =>
    ({ id: q.id, label, options: [...q.options], day: q.day, ...(posterUrl ? { posterUrl } : {}) });
  return {
    name: game.name, promotion: game.promotion, eventDate: game.eventDate,
    // epoch millis -> "YYYY-MM-DDTHH:mm" in local time for datetime-local
    lockTimeLocal: new Date(game.lockTime - new Date(game.lockTime).getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    dayCount: Math.max(1, game.dayCount || 1), tiebreaker: game.tiebreakerQuestion,
    matches: game.matches.map((m) => toDraft(m, m.name, m.posterUrl)),
    props: game.propBets.map((p) => toDraft(p, p.question)),
  };
}
```

- [ ] **Step 2: Add `superAdminOnly` to `ProtectedRoute`.** Extend the props and, after the existing admin check:

```tsx
export function ProtectedRoute({ children, adminOnly = false, superAdminOnly = false }:
  { children: ReactNode; adminOnly?: boolean; superAdminOnly?: boolean }) {
  // …existing loading + !user guards…
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  if ((adminOnly || superAdminOnly) && !isAdmin) return <Navigate to="/app" replace />;
  if (superAdminOnly && user.role !== 'superadmin') return <Navigate to="/admin" replace />;
  // …existing return…
}
```

- [ ] **Step 3: Create `EditGame.tsx`:**

```tsx
import { useNavigate, useParams } from 'react-router-dom';
import { PageTitle, Eyebrow } from '@/components/primitives';
import { Link } from 'react-router-dom';
import { GameForm, draftFromGame } from '@/pages/admin/GameForm';
import { updateGame } from '@/lib/store';
import { useGame } from '@/hooks/data';

export function EditGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { game, loading } = useGame(gameId);
  if (loading) return <p className="text-muted">Loading…</p>;
  if (!game) return <p className="text-muted">That game doesn't exist or you don't have access to it.</p>;
  if (game.status === 'CLOSED') return <p className="text-muted">Closed games are final and can't be edited.</p>;
  return (
    <div>
      <Link to={`/admin/game/${game.id}`} className="no-underline"><Eyebrow>← Back to console</Eyebrow></Link>
      <div style={{ marginBottom: 22 }}><PageTitle>Edit {game.name}</PageTitle></div>
      <GameForm
        initial={draftFromGame(game)}
        submitLabel="Save changes" busyLabel="Saving…"
        onCancel={() => navigate(`/admin/game/${game.id}`)}
        onSubmit={async (input) => { await updateGame(game.id, input); navigate(`/admin/game/${game.id}`); }}
      />
    </div>
  );
}
```

(The orphan-warning `beforeSubmit` is added in Task 6.)

- [ ] **Step 4: Wire the route + Edit button.** In `App.tsx`, add:

```tsx
<Route path="/admin/game/:gameId/edit" element={<ProtectedRoute superAdminOnly><EditGame /></ProtectedRoute>} />
```

In `AdminGame.tsx`, alongside the header, render an Edit link only for a super admin on a non-closed game (uses `useAuth`):

```tsx
{user?.role === 'superadmin' && !closed && (
  <Link to={`/admin/game/${game.id}/edit`} className="no-underline"><Eyebrow>Edit game</Eyebrow></Link>
)}
```

- [ ] **Step 5: Typecheck, build, manual verify.**

Run: `npx tsc -b && npm run build`
Then run the app: as a super admin, open a live game → **Edit game** → change the name / add a match / attach a poster → Save → returns to console with changes applied. As a plain admin, confirm no Edit button and that visiting `/edit` redirects to `/admin`.

- [ ] **Step 6: Commit.**

```bash
git add src/pages/admin/EditGame.tsx src/pages/admin/GameForm.tsx src/App.tsx src/components/ProtectedRoute.tsx src/pages/admin/AdminGame.tsx
git commit -m "feat: edit-game screen, route, and super-admin gate (#22)"
```

---

### Task 6: Admin orphan warning before an edit commits

**Files:**
- Modify: `src/pages/admin/EditGame.tsx` (add `beforeSubmit` using `orphanImpact` + a confirm dialog)
- Reuse: existing dialog/modal primitive if one exists; otherwise a minimal inline confirm (see below)

**Interfaces:**
- Consumes: `orphanImpact`, `gameQuestions` (Task 3), `subscribeSubmissions` or a one-shot submissions read.

- [ ] **Step 1: Read the game's submissions once** in `EditGame` (a super admin may read them). Add state `const [subs, setSubs] = useState<Submission[]>([])` and subscribe via the existing `subscribeSubmissions(game.id, setSubs)` in an effect (cleanup on unmount).

- [ ] **Step 2: Add `beforeSubmit`.** Compute impact against the DRAFT questions the form built:

```tsx
const beforeSubmit = async (input: NewGameInput): Promise<boolean> => {
  const impact = orphanImpact(gameQuestions(input), subs);
  if (impact.totalAffected === 0) return true;
  const lines = impact.byOption
    .map((b) => `${b.count} ${b.count === 1 ? 'player' : 'players'} picked “${b.option}”`)
    .join('; ');
  return window.confirm(
    `This change orphans picks for ${impact.totalAffected} ${impact.totalAffected === 1 ? 'player' : 'players'} ` +
    `(${lines}). Their picks for those questions will no longer count. Save anyway?`,
  );
};
```

Pass `beforeSubmit={beforeSubmit}` to `GameForm`. (If the project prefers a styled dialog over `window.confirm`, use the existing modal primitive — but per the browser-automation guidance, avoid a native `confirm` if this ever runs under automation; a small in-page confirm panel is preferable. Implement a lightweight confirm panel matching the app's `Card` styling if time permits; `window.confirm` is the acceptable MVP.)

- [ ] **Step 3: Typecheck + manual verify.** Edit a game that has submissions: remove an option a player picked → the confirm fires with the right count; cancel aborts the save; confirm proceeds. A cosmetic edit (rename game, add a brand-new question) saves with no prompt.

- [ ] **Step 4: Commit.**

```bash
git add src/pages/admin/EditGame.tsx
git commit -m "feat: warn before an edit orphans players' picks (#23)"
```

---

### Task 7: Player "re-pick" flag

**Files:**
- Modify: the user picks view `src/pages/user/UserGame.tsx` (and/or its pick-rendering child) and the user dashboard card where a game the player entered is shown.

**Interfaces:**
- Consumes: `gameQuestions`, `orphanedPickIds`, `unansweredQuestionIds`, `submissionPicks` (Task 3), the player's own `Submission`, and `isLocked(game)`.

- [ ] **Step 1: Compute the flag** where the player's submission for a game is available:

```ts
const questions = gameQuestions(game);
const picks = submissionPicks(mySubmission);
const needsAttention = [
  ...orphanedPickIds(questions, picks),
  ...unansweredQuestionIds(questions, picks),
];
```

- [ ] **Step 2: Surface it.** Per-question, when a question's id is in `needsAttention`, render an inline marker on that question ("Changed — re-pick"). At the game level, if `needsAttention.length > 0` and the game is **not** locked, show a banner linking to re-pick ("This game changed after you locked in — review your picks"). If the game **is** locked, show the same information as read-only/informational (picks are frozen by the server clock; no re-pick affordance). Use existing token colors (`var(--color-gold)` for the notice) — no hardcoded hex.

- [ ] **Step 3: Manual verify (both windows).** Pre-lock: a super admin renames an option the player picked → the player's picks view flags that question and lets them re-pick and re-save. Post-lock: the same edit shows the informational flag but no re-pick control. A player with no affected picks sees nothing.

- [ ] **Step 4: Commit.**

```bash
git add src/pages/user/UserGame.tsx
git commit -m "feat: flag players whose picks a live edit changed (#23)"
```

---

### Task 8: `deleteGame` callable + delete rules coverage

**Files:**
- Create: `functions/src/deleteGame.ts`
- Modify: `functions/src/index.ts` (re-export)
- Test: `tests/e2e/rules.test.ts` (the delete rule is already covered by "lets only a super admin delete a game"; add a subcollection note if needed — no rule change here)

**Interfaces:**
- Produces: callable `deleteGame({ gameId })` → `{ deleted: true }`; consumed by Task 9's client wrapper.

- [ ] **Step 1: Implement the callable.** Create `functions/src/deleteGame.ts` (mirrors the `sendNightStandings` auth pattern):

```ts
// deleteGame — Super-Admin-only hard delete of a game and ALL its subcollections.
//
// Must be a callable using the Admin SDK: the client cannot delete `submissions`
// (allow delete: if false) or `leaderboard`, so a client-side delete would half-succeed.
// recursiveDelete removes the doc + every subcollection and bypasses these rules. It does
// NOT emit per-doc delete events, so onResultWrite/onGameClose do not fire during a delete.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const deleteGame = onCall<{ gameId?: string }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const db = getFirestore();
  const role = (await db.doc(`users/${uid}`).get()).data()?.role;
  if (role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Only a Super Admin can delete a game.');
  }

  const gameId = request.data?.gameId;
  if (typeof gameId !== 'string' || !gameId) throw new HttpsError('invalid-argument', 'Which game?');
  if (!(await db.doc(`games/${gameId}`).get()).exists) throw new HttpsError('not-found', 'That game no longer exists.');

  await db.recursiveDelete(db.doc(`games/${gameId}`));
  return { deleted: true };
});
```

- [ ] **Step 2: Re-export** in `functions/src/index.ts`, next to the other re-exports:

```ts
// Super-Admin-only hard delete (game + all subcollections) via Admin-SDK recursiveDelete.
export { deleteGame } from './deleteGame';
```

- [ ] **Step 3: Typecheck functions.**

Run: `npx tsc --noEmit -p functions/tsconfig.json`
Expected: PASS.

- [ ] **Step 4: Verify the delete rule test still passes** (no rule change; confirms `isSuperAdmin()` delete is intact).

Run: `PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" npm run test:e2e`
Expected: PASS incl. "lets only a super admin delete a game".

- [ ] **Step 5: Commit.**

```bash
git add functions/src/deleteGame.ts functions/src/index.ts
git commit -m "feat(functions): deleteGame callable (super-admin recursiveDelete) (#24)"
```

---

### Task 9: Delete UI — type-to-confirm + client wrapper + demo mode

**Files:**
- Modify: `src/lib/store.ts` (client `deleteGame` wrapper)
- Create: `src/components/DeleteGameDialog.tsx`
- Modify: `src/pages/admin/AdminGame.tsx` (Delete entry point, super-admin only)

**Interfaces:**
- Consumes: the `deleteGame` callable, `functions`, `httpsCallable`, `isFirebaseConfigured`.
- Produces: `deleteGameById(gameId): Promise<void>`; `<DeleteGameDialog game onClose onDeleted />`.

- [ ] **Step 1: Client wrapper** in `src/lib/store.ts` (mirror `sendNightStandings`):

```ts
/** Super-Admin-only hard delete via the callable (Admin SDK does the recursive delete). */
export async function deleteGameById(gameId: string): Promise<void> {
  if (!functions) throw new Error('Deleting a game needs a live Firebase connection.');
  const callable = httpsCallable<{ gameId: string }, { deleted: boolean }>(functions, 'deleteGame');
  await callable({ gameId });
}
```

- [ ] **Step 2: Dialog** `src/components/DeleteGameDialog.tsx` — a `Card`-styled panel (not `window.confirm`), showing what's destroyed and requiring the game name typed:

```tsx
import { useState } from 'react';
import { Card } from '@/components/primitives';
import { deleteGameById } from '@/lib/store';
import { isFirebaseConfigured } from '@/lib/firebase';
import type { Game } from '@/types';

export function DeleteGameDialog({ game, playerCount, onClose, onDeleted }:
  { game: Game; playerCount: number; onClose: () => void; onDeleted: () => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const armed = typed.trim() === game.name.trim() && isFirebaseConfigured && !busy;

  const run = async () => {
    setBusy(true); setError('');
    try { await deleteGameById(game.id); onDeleted(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete the game.'); setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <Card style={{ padding: 24, maxWidth: 460, width: '90%' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8 }}>Delete “{game.name}”?</h3>
        <p style={{ color: '#C0392B', fontSize: 13, marginBottom: 8 }}>
          This permanently removes the game and everything under it: {playerCount}{' '}
          {playerCount === 1 ? "player's picks" : "players' picks"}, all results, the leaderboard,
          and the email log. This cannot be undone.
        </p>
        {!isFirebaseConfigured && (
          <p style={{ color: '#6B7A99', fontSize: 12 }}>Deleting needs a live Firebase connection — unavailable in demo mode.</p>
        )}
        <label style={{ fontSize: 12, color: '#6B7A99' }}>Type the game name to confirm</label>
        <input value={typed} onChange={(e) => setTyped(e.target.value)}
          style={{ width: '100%', background: 'rgba(0,0,0,.3)', border: '1.5px solid rgba(255,255,255,.12)', borderRadius: 10, padding: '11px 13px', color: '#F5F5F5', fontFamily: 'inherit', margin: '6px 0 14px' }} />
        {error && <p style={{ color: '#C0392B', fontSize: 12, marginBottom: 8 }}>{error}</p>}
        <div className="flex gap-3">
          <button onClick={run} disabled={!armed} className="cursor-pointer font-black"
            style={{ flex: 1, border: 'none', borderRadius: 12, padding: 14, background: armed ? '#C0392B' : 'rgba(192,57,43,.35)', color: '#fff', cursor: armed ? 'pointer' : 'default' }}>
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
          <button onClick={onClose} className="cursor-pointer bg-transparent font-extrabold"
            style={{ border: '1.5px solid rgba(255,255,255,.16)', color: '#F5F5F5', borderRadius: 12, padding: '0 22px' }}>Cancel</button>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Entry point** in `AdminGame.tsx` — super-admin only. Add state `const [confirmDelete, setConfirmDelete] = useState(false)`, a "Delete game" control in the header (styled subtly, red), read the player count from a submissions subscription or `PlayersPanel`'s data (a `subscribeSubmissions` count), render `<DeleteGameDialog … onDeleted={() => navigate('/admin')} />` when `confirmDelete`. Gate the control on `user?.role === 'superadmin'`. In demo mode the dialog itself shows the disabled explanation and the armed check fails, so the button stays inert.

- [ ] **Step 4: Typecheck, build, manual verify.**

Run: `npx tsc -b && npm run build`
Then, as a super admin: open a throwaway game → Delete → the button stays disabled until the exact name is typed → delete → lands on `/admin`, game gone. **Verify in Firestore directly** that the game doc and all five subcollections are gone (don't infer from the UI). As a plain admin: no Delete control.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/store.ts src/components/DeleteGameDialog.tsx src/pages/admin/AdminGame.tsx
git commit -m "feat: delete-game type-to-confirm dialog + client wrapper (#24)"
```

---

## Ship

- [ ] **Full test suite:** `npm test` (unit) and `PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" npm run test:e2e` (rules) both green.
- [ ] **Lint + build:** `npm run lint && npm run build`.
- [ ] **Impeccable de-slop pass** on changed frontend files (`EditGame.tsx`, `GameForm.tsx`, `DeleteGameDialog.tsx`, `AdminGame.tsx`, user picks view): `impeccable detect <files>`; fix findings.
- [ ] **Code review** (shipping-gate) on the branch, then push.
- [ ] **PR** referencing `Fixes #22`, `Fixes #23`, `Fixes #24`, closing `#21` on merge.
- [ ] **Deploy:** `npm run build && firebase deploy` (functions + rules + hosting). `deleteGame` is a new function — confirm it appears in the deploy output for us-west1.
- [ ] **Prod smoke:** attach a poster to the existing published game via Edit (the original P2 motivation), and confirm the pick-orphan warning + player flag on a test edit.
- [ ] **Update `TOKEN_LOG.md`** with the implementation work unit + Cost Drivers.

## Self-review (author check against the spec)

- **Spec coverage:** edit permission → Task 1; `updateGame` → Task 2; orphan/unanswered logic → Task 3; edit UI + gate → Tasks 4–5; admin warning → Task 6; player flag → Task 7; delete callable → Task 8; delete UI/guard/demo → Task 9. All spec sections mapped.
- **Types consistent:** `NewGameInput` (existing) is the single edit payload type across Tasks 2/4/5/6; `QuestionOptions`/`OrphanImpact` defined in Task 3 and consumed unchanged in 6–7; `GameFormInitial`/`GameFormProps` defined in Task 4 and consumed in 5–6.
- **No placeholders:** every code step carries real code; the only deferred detail is Task 7's exact insertion points inside the user picks view (a known component) — logic fully specified via Task 3.
- **Invariants:** closed-game freeze untouched (Tasks 1, 5); posters via `PosterPicker` (Task 4); scoring mirrors untouched; copy uses Pop/Drop; demo mode degrades (Tasks 4, 9).
