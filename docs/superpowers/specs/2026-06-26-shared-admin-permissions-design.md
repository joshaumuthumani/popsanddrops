# Shared-Admin Permissions — Design

**Date:** 2026-06-26
**Status:** Approved, ready for implementation plan

## Goal

Change the role model so that **every Admin is a full operator on every game**, and **Super Admin** is the only role that can **manage admins** (assign/revoke roles) and **delete games**. This fixes the current behavior where a newly promoted Admin sees an empty console because they only see games they personally created.

## Role model (target)

| Capability | User | Admin | Super Admin |
|---|:--:|:--:|:--:|
| Join & play games (submit picks) | ✅ | ✅ | ✅ |
| See the admin console | — | ✅ | ✅ |
| See **all** games (past + present) | — | ✅ | ✅ |
| Create a new game | — | ✅ | ✅ |
| Edit game details before lock | — | ✅ | ✅ |
| Enter live results | — | ✅ | ✅ |
| View player submissions | — | ✅ | ✅ |
| Close game + send results emails | — | ✅ | ✅ |
| Manage admins (assign/revoke roles) | — | — | ✅ |
| Delete a game | — | — | ✅ |

"Admin" = trusted organizer who can run anything. "Super Admin" = Admin + the two governance/destructive levers.

## Current state (what exists today)

- **Client** — `useAdminGames` (src/hooks/data.ts): super admin subscribes to all games; plain admin subscribes only to games whose `admins` array contains their uid. `isGameAdmin(game, user)` returns `superadmin || game.admins.includes(uid)`, and gates `useSubmissions` read access.
- **Rules** (firestore.rules) — `isGameAdmin(gameId)` = signed-in AND (`uid in game.admins` OR super admin). Used for results writes and submission reads. Game `update` allowed for game admins (and blocked when `CLOSED`); `delete` allowed for `createdBy` or super admin. Role changes (`/users` update) require super admin.
- **UI** — `ProtectedRoute` admin routes allow `admin`/`superadmin`; `AppHeader` shows the User/Admin toggle for `admin`/`superadmin`; "Manage admins" link and `AdminManagement` actions are super-admin-only; `AdminDashboardPanel` "Organizer" card lists the game's `admins` array.

## Design

Replace per-game `admins`-array membership with a **global role check**. The `admins` array stops controlling access; `createdBy` is retained only as the "Organizer" label.

### 1. Client (`src/hooks/data.ts`)
- `useAdminGames(user)`: subscribe to **all games** for both `admin` and `superadmin` (today only `superadmin` does). The `subscribeAdminGames` array-contains query is no longer used.
- `isGameAdmin(game, user)`: return `user.role === 'admin' || user.role === 'superadmin'` (drop the `game.admins.includes` check). This makes `useSubmissions` readable by any admin, so any admin can view player picks and the live board.

### 2. Rules (`firestore.rules`)
- Add helper `isAdmin()` = signed-in AND `userRole(uid) in ['admin','superadmin']` (reads the caller's `/users` doc).
- `games`:
  - `read`: signed-in (unchanged).
  - `create`: `isAdmin()` AND `request.resource.data.createdBy == uid()`.
  - `update`: `isAdmin()` AND `resource.data.status != 'CLOSED'`.
  - `delete`: `isSuperAdmin()`.
- `results/{questionId}` `write`: `isAdmin()` AND game not `CLOSED` (unchanged except `isGameAdmin` → `isAdmin`).
- `submissions/{u}` `read`: `u == uid()` OR past-lock OR `isAdmin()` (was `isGameAdmin`).
- `leaderboard`: unchanged (read signed-in; writes only via Cloud Functions / Admin SDK).
- `users/{u}` `update`: unchanged — `isSuperAdmin()` OR self with unchanged role.
- Remove the now-unused `isGameAdmin(gameId)` rule helper.

### 3. UI
- `AdminDashboardPanel` "Organizer" card: show `createdBy` as the owner plus a one-line note that any admin can manage the game. Stop iterating the per-game `admins` array.
- No other UI changes: the header toggle, admin routes, and "Manage admins" gating already key off `admin`/`superadmin` vs `superadmin`.

### 4. Optional cleanup
- `subscribeAdminGames` in `src/lib/store.ts` becomes unused; remove it (and any now-unused imports).

## Out of scope (deferred)
- **Delete-game UI** — the Rule gates delete to `superadmin`, but no button/dialog is built this round.
- **Edit-existing-game-details UI** — never existed; the `update` rule supports it for a future screen.

## Edge cases & notes
- The per-game `admins` array on game documents becomes vestigial. New games may still write `admins: [creator]` harmlessly; it no longer gates anything. `createdBy` is the source of truth for "Organizer."
- Rules cost: `isAdmin()` adds one document read per admin write/submission-read evaluation — well under Firestore's per-request access limit at this scale.
- "Closed = frozen" behavior is preserved for everyone (admins included).

## Acceptance criteria
1. A user newly promoted to **Admin** sees **all** games (live + past) in the console without creating any.
2. An Admin can enter live results, view any player's submission, and close+email **any** game.
3. An Admin **cannot** reach Manage Admins (no link; role-change writes denied by Rules).
4. **Delete** is denied for Admins at the Rules level (and unavailable in UI for everyone this round).
5. Super Admin retains everything plus Manage Admins.
6. A **CLOSED** game remains read-only for all roles.
