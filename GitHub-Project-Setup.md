# GitHub Project Setup — Reusable Playbook

A repeatable recipe for standing up any new project with a typed issue hierarchy
(Feature → Story → Task) tracked on a GitHub Project board with a clean set of views.
Follow the steps top to bottom on any new repo and you'll have the same structure in ~15 minutes.

> Placeholders use angle brackets — `<owner>`, `<repo>`, `<Board Name>`, `<you>`.
> Swap in your own names as you go.

---

## 0. What you end up with

- One `type:` label per issue that doubles as an issue-type (personal repos can't use GitHub's
  native issue types, so labels stand in).
- A three-level hierarchy — **Feature → Story → Task** — wired with GitHub **sub-issues**.
- A Project board with a **Status** field (Todo / In Progress / Done) and multiple views,
  including a **Backlog** table with hierarchy nesting turned on.
- A `README.md` project overview (front door) and a `CLAUDE.md` that tells any AI agent (and you)
  the rules of the road.

---

## 1. Repo, README, and `CLAUDE.md`

1. Create the repo (private is fine).
2. Add a **`README.md`** — the project's front door and overview (skeleton below).
3. Add a `CLAUDE.md` at the root documenting the board workflow so every agent/session follows it.
   Recommended rules:
   - No uncaptured work — every change maps to a GitHub issue.
   - Exactly one `type:` label per issue.
   - Hierarchy via sub-issues: `feature → story → task`.
   - Add every issue to the board and set **Status = Todo**.
   - Reference the issue in commits/PRs (`Fixes #12`) so it auto-links and auto-closes.
   - Guardrails: never commit secrets, target WCAG 2.1 AA for anything user-facing, security-check
     before opening a PR.

### Project overview `README.md` — skeleton

Start every repo with a README that answers "what is this, how do I run it, how is work tracked."
Copy this skeleton and fill in the blanks:

```markdown
# <Project Name>

<One-line description of what it is and who it's for.>

## About
<A short paragraph: the problem it solves and the core idea.>

## Features
- **<Feature>** — <what it does>
- **<Feature>** — <what it does>

## Tech Stack
| Layer | Tooling |
| --- | --- |
| Framework | <e.g. React, Vite, TypeScript> |
| State | <e.g. Zustand> |
| Database | <e.g. Supabase / Postgres> |
| Hosting | <e.g. Cloudflare Pages> |
| Testing | <e.g. Vitest> |

## Getting Started
### Prerequisites
- <e.g. Node.js 20+>

### Setup
```bash
git clone <repo-url>
cd <repo>
npm install
cp .env.example .env.local   # fill in your values
npm run dev
```

## Environment Variables
| File | Key | Required | Purpose |
| --- | --- | --- | --- |
| `.env.local` | `<KEY>` | Yes | <what it's for> |

> **Never commit real secrets.** Keep env files gitignored; manage prod values in your host's secret store.

## Scripts
| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run test` | Run tests |

## Project Structure
```
<repo>/
├── src/        # app source
├── docs/       # specs & docs
└── ...
```

## Project Board & Workflow
Work is tracked on the **<Board Name>** GitHub Project (repo → **Projects** tab) using a
**Feature → Story → Task** issue hierarchy. Status flows **Todo → In Progress → Done**;
commits/PRs reference issues (`Fixes #12`) to auto-close on merge.
See [GitHub-Project-Setup.md](GitHub-Project-Setup.md) for the full setup and [CLAUDE.md](CLAUDE.md) for contributor/agent rules.

## Deployment
<How it ships — e.g. push to `main` → Cloudflare Pages.>

## License
<e.g. MIT>
```

> Keep the README's **Project Board & Workflow** section pointing at this playbook and `CLAUDE.md`
> so the overview and the process stay linked.

---

## 2. Create the four `type:` labels

Create these once per repo (Issues → Labels → New label). Colors are just suggestions.

| Label | Color (hex) | Description |
|---|---|---|
| `type: feature` | `#1D76DB` (blue) | New capability or functionality (top of the hierarchy) |
| `type: story` | `#8250DF` (purple) | A user-facing slice of a Feature, delivered as one or more Tasks |
| `type: task` | `#FBCA04` (yellow) | A single, concrete unit of work under a Story |
| `type: bug` | `#D73A4A` (red) | A defect or unexpected behavior to fix |

**Fast path with the `gh` CLI:**

```bash
gh label create "type: feature" --color 1D76DB --description "New capability or functionality (top of the hierarchy)"
gh label create "type: story"   --color 8250DF --description "A user-facing slice of a Feature, delivered as one or more Tasks"
gh label create "type: task"    --color FBCA04 --description "A single, concrete unit of work under a Story"
gh label create "type: bug"     --color D73A4A --description "A defect or unexpected behavior to fix"
```

Rule: **exactly one** `type:` label per issue.

---

## 3. Issue hierarchy + naming conventions

**Hierarchy (via GitHub sub-issues):**

```
feat: <capability>            (type: feature)
 └── story: <user-facing slice>   (type: story)   ← linked as sub-issue of the feature
      └── task: <concrete unit>       (type: task)   ← linked as sub-issue of the story
```

Link children on the parent issue via **Create sub-issue** / **Add sub-issue** (bottom of the
issue's Sub-issues panel). The parent then shows a `0/N` progress bar automatically.

**Title conventions** (imperative, prefixed):

- `feat:` new feature — `feat: <capability name>`
- `story:` user-facing slice — `story: <user-facing outcome>`
- `task:` concrete work — `task: <specific unit of work>`
- `bug:` / `fix:` defect — `bug: <what's broken>`
- Other useful prefixes: `ux:`, `a11y:`, `style:`, `chore:`, `docs:`

**Issue body template:**

```
Parent: #<n> — <parent title> · Priority: P0/P1/... · Type: Story

<one-paragraph description of what and why>

Acceptance criteria:
- <testable outcome 1>
- <testable outcome 2>
```

> Note on Tasks: a good default is to not pre-create Tasks by hand. Break Stories down into
> Tasks during the coding session (e.g. by your coding agent), then link them as sub-issues.
> Keep the Task layer lightweight until you're actually building the Story.

---

## 4. Create the Project board

1. Go to your profile → **Projects** → **New project** → start from **Table**. Name it
   `<Board Name>` (e.g. "<Project> Board"). This is a **user-level** project
   (URL: `github.com/users/<you>/projects/<n>`).
2. Link the repo: from the repo's **Projects** tab → **Link a project** → select the board.
   (Or add issues to it directly; see step 6.)

---

## 5. Configure the Status field

The board ships with a **Status** single-select. Standardize the options to:

- **Todo** — captured, not started
- **In Progress** — actively being worked
- **Done** — complete (merging a linked PR moves it here automatically)

Every new issue should land in **Todo**.

---

## 6. Add issues to the board (in bulk)

The fastest way to add many issues at once — do this from the repo's **Issues** list, not one by one:

1. Filter to what you want, e.g. `is:issue is:open label:"type: story"`.
2. Click the header checkbox to **select all** on the page (GitHub shows ~25/page).
3. Use the **Project** dropdown in the bulk action bar → check your board.

> Watch the checkbox state: a **solid check** means the selected issues are *already* on the
> board — clicking it would *remove* them. Only click to toggle when it's unchecked.

Sub-issues (Stories, Tasks) must be board items for them to nest under their parent in the
hierarchy view (see step 7).

---

## 7. Set up the views

The board can hold several saved views (tabs). A useful set:

**a) "Backlog" — the main hierarchy table**
- Layout: **Table**.
- Open **View options** (the ⚙ "View" button) → turn **Show hierarchy = On**.
  With hierarchy on and all Features + Stories added as board items, each Feature gets an
  expand chevron and its Stories (and later Tasks) nest underneath.
- This is the primary "Feat → Story → Task" tree.

**b) "By Type" — table sliced by label**
- Layout: **Table** → **Slice by = Labels**.
- The left panel then lets you filter to `type: feature / story / task / bug`.
- Leave it **deselected** (click "Deselect" in the slice panel) so it opens showing everything.

**c) Built-in extras** (keep or drop as useful): **Board** (Kanban by Status), **Roadmap**
(timeline), **My items**, **Priority board**.

**Renaming a view:** click the view tab's dropdown (▾) → **Rename view**, then type the name and
Enter. Give views real names — don't leave "View 1 / View 7" lying around.

---

## 8. Workflows (built-in automation)

In the project, open **Workflows** (top right) and enable the ones you want. Useful defaults:

- **Item added to project → set Status = Todo** (so new items are captured consistently).
- **Item closed → set Status = Done.**
- **Pull request merged → set Status = Done** (pairs with `Fixes #<n>` in the PR).

---

## 9. Day-to-day working rules

- Before coding: find/create the issue, apply one `type:` label, link it into the hierarchy,
  add to board, Status = **Todo**.
- Starting work: move to **In Progress**.
- Every commit/PR references the issue: `Fixes #12` / `Closes #12` so it links and auto-closes.
- On merge: the linked issue auto-moves to **Done**.
- Keep sub-issue checklists current so parent `0/N` progress bars stay accurate.

---

## Quick checklist (new repo)

- [ ] Repo created; `README.md` (project overview) + `CLAUDE.md` (board workflow + guardrails) added
- [ ] Four `type:` labels created (feature / story / task / bug)
- [ ] Project board created and linked to the repo
- [ ] Status options set to Todo / In Progress / Done
- [ ] Features created; Stories created and linked as sub-issues
- [ ] All issues added to the board, Status = Todo
- [ ] "Backlog" view: Table + Show hierarchy = On
- [ ] "By Type" view: Table + Slice by Labels (deselected)
- [ ] Views renamed sensibly; stray default views removed
- [ ] Workflows enabled (added → Todo; closed/merged → Done)

---

## Appendix — reference values

**Label colors:** feature `#1D76DB` · story `#8250DF` · task `#FBCA04` · bug `#D73A4A`

**Project URL shape:** `https://github.com/users/<you>/projects/<n>` (user-level project)

**Handy issue filters:**
- `is:issue is:open label:"type: story"` — all open stories
- `is:issue is:open label:"type: feature"` — all open features

*A reusable project-setup playbook — edit freely as the process evolves.*
