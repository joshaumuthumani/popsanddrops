# Token Log

Tracks token usage at a consolidated, per-task level for later review and process
improvement. One row per logically complete unit of work — not per tool call or
message. See the project's CLAUDE.md and `~/.claude/CLAUDE.md` (Token Log convention)
for the full rules.

| Date | Task / Feature | Est. Tokens | Context Size (approx) | Cost Drivers | Notes / Improvement Ideas |
|------|-----------------|-------------|------------------------|--------------|----------------------------|
| 2026-07-20 | CI "startup_failure" investigation + record correction, triggered a fresh CI run | ~35k (est.) | large (compacted resume session) | Read `ci.yml`, git-showed `b8c061b`, and inspected `gh run` history/headSha to prove the outage (not the concurrency expression) caused the failure. Two avoidable retries: the compound `git add && commit && push` got intercepted by the push-gate hook so the commit never landed and had to be redone standalone; and `npm test` piped through `tail` didn't satisfy the test-gate sentinel, forcing an unpiped rerun. | Avoidable: don't chain `git commit` with `git push` — the push-gate hook intercepts the whole command and eats the commit. Run test-gate commands unpiped so the sentinel registers. Worth the cost: verifying the run's headSha before asserting the outage claim in the commit message. |
| 2026-07-20 | Super Admin (edit OPEN games + delete games) — brainstorm → approved design spec | ~95k (est.; ~72k of it the mapping subagent) | large | One `Explore` subagent (~72k) mapping game lifecycle / store mutations / Firestore rules / routing / subcollections / functions; then a 5-question structured brainstorm (edit scope, edit model, player-notice scope, closed-game freeze, delete guard) and writing `docs/superpowers/specs/2026-07-20-super-admin-design.md`. | Worth the cost — the mapping prevented false design assumptions (only OPEN/CLOSED are ever written; delete needs Admin-SDK recursiveDelete because the client can't delete submissions; picks keyed by option *text* is the core edit hazard). Brainstorm itself was cheap (AskUserQuestion, no prose churn). Impl not started; the rules tightening is flagged to build test-first against the emulator. |
| 2026-07-20 | Super Admin implementation — edit live games + delete games (9 tasks, TDD) | ~180k (est.) | large | Writing-plans doc, then 9 TDD tasks: rules tightening (emulator test-first), updateGame + pure helpers, pickIntegrity, GameForm extraction, EditGame + orphan warning, player re-pick flag, deleteGame callable, delete dialog. Repeated tsc/lint/build/vitest/emulator cycles per task. A browser-driven demo-mode verification at the end (chrome MCP) that caught a real white-screen crash (subscribeSubmissions → reqDb throws in demo) which ALL of tsc/build/lint/impeccable/89 tests had missed. | Worth the cost: the browser drive was the only thing that caught the demo-mode crash — automated checks are blind to runtime-only React effects. Avoidable: two SPA reloads via URL nav dropped in-memory demo auth and forced re-sign-in; navigate within the app instead. TDD-first on the rules paid off (caught the permissive-admin gap immediately). |
| 2026-07-20 | Verify the new "Token Log" global instruction + create this file | ~10k (est.) | large | Several `~/.claude` filesystem greps, run twice because the user's `CLAUDE.md` edit hadn't saved on the first check (repasted after). | Avoidable next time: a single targeted `find -newermt` + `cat ~/.claude/CLAUDE.md` would have covered it in one pass once the file existed. Low cost overall. |
<!--
Fill-in guide (short): Date = when the task wrapped. Task = what was accomplished.
Est. Tokens = best estimate for the whole task, mark estimates. Context Size =
small/medium/large. Cost Drivers = THE key column: what consumed the bulk, what was
avoidable, what was worth it. Notes = patterns/ideas for next time.
Group by *driver* (not task) when running an optimization pass. Archive to
TOKEN_LOG_ARCHIVE.md past ~50 rows.
-->
