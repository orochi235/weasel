# The fleet

How branch and `main` runs on the fleet work, past the rules in `CLAUDE.md` ("Worktrees and the
fleet"). For anyone running or reading a fleet job.

**On a branch, a fleet run tests only what the branch reaches.** The test files whose imports lead to
a changed path run, and the gate runs all but the slow checks whose inputs the branch leaves alone
(below); `main` and a bare commit run everything, and so does `--full`. A change to a root manifest or
tsconfig, a setup file, or anything `vitest.config.ts` loads runs everything too — the `triggers` list
there. A trigger one package owns — its `package.json`, a `tsconfig`, its vite or vitest config — runs
that package's tests and its dependents' instead (`SCOPED` beside `triggers`), and so does a lockfile
change that touches only workspace entries, such as a version bump; one that changes an external
package runs everything. A file read at build time rather than imported,
such as an icon definition a plugin generates from, selects nothing on a branch and is caught only by
the full run on `main` after the merge. Add such a path to `triggers` once it has slipped through.
A changed path is one the branch adds to local `main`, or to `origin/main` when that is newer: the
node builds on the pushed merge-base, but unpushed `main` commits are not the branch's changes.
`--since <ref>` selects from what the branch adds past `<ref>` instead, for a branch stacked on one
whose own run was green.

**Draw is served from `.claude/worktrees/view`, a detached checkout of `main`**, so edits to the
main checkout don't reload the browser tab mid-session. A local `pre-push` hook runs
`scripts/advance-view.mjs` on every push to `main`, moving it to the pushed commit (and running
`npm ci` and restarting draw when the lockfile changed); `npm run view:advance` does the same by hand.

**`npm run dev:fleet -- draw forge` serves dev servers from a fleet node instead of this machine.**
It installs into one scratch tree there (`weasel-dev`), runs the apps as an onto service, prints each
address, and syncs every edit made here until Ctrl-C stops the servers; `--drop` removes the tree. Drive
it headless from here with chrome-devtools or Playwright by the printed IP: headless Chrome resolves no
`.local` names. `DRAW_E2E_URL=http://<ip>:33452 npm run test:e2e:draw` runs draw's e2e suite against it.

**keiei takes no weasel jobs** (`onto set keiei --refuse repo:orochi235/weasel`, 2026-10-29). With 24 GB
and 7–11 GB of swap it failed forge's timeline test in five full runs on 2026-10-20, where the other nodes
pass it in 20–44 s. `onto set keiei --allow repo:orochi235/weasel` takes it back.

**The fleet also runs the `gate` project**: the typecheck, lint, and `check:*` steps CI runs,
read from `ci.yml` by `scripts/ci-checks.gate.ts`, each as a test. CI only runs on a push, so
this is what says a commit would fail there. `test:fleet` runs it with everything else, so read its
results from that log. Don't run `npm run test:gate` yourself: it runs typecheck, lint and every
check on the machine that types it.

**On a branch run the gate skips `check:needs`, `check:forge-stories`, `check:first-publish`,
`audit:jsdoc` and `check:test-projects` when the branch changes none of the paths each reads**,
listed in `scripts/lib/gate-inputs.mjs`; the log shows each as skipped, with a `gate: skipped` line
saying why. A change to ci.yml, the gate, `scripts/lib/`, a manifest, the lockfile or a tsconfig runs
them all. `check:test-projects` asks only whether the branch adds or deletes a test file, since an
edit to one cannot change which project collects it. A script that starts reading a new path needs
that path added there, or a branch changing only it will skip the check; `main` still runs it.

**Typecheck keeps its build info between runs.** `.tsbuildinfo/` is ignored, so onto's sync leaves
it in the node's tree, and tsc rechecks only files whose content, or whose imports' exported types,
changed; it keys on content, never mtime (`scripts/typecheck-incremental.test.ts`). A branch run
keeps its own copy (`.tsbuildinfo/branch--<name>--*`), started from main's and pruned after a week
of disuse, so that rerunning a branch rechecks only its new edits rather than whatever the node ran
last. `scripts/typecheck.mjs` swaps that copy into the path the tsconfig names for the run and puts
main's back after: tsc records its build info path and reads one written under another as none.

An edit to an export that most of the repo imports costs as much as no build info, or more: on
teitou on 2026-10-29 the two programs took 36 s together with no build info and the node idle, 6 s
with nothing changed, and 94 s after one export was added to `@weasel-js/core`'s index with 7–13 of
its cores busy (`scripts/bench-typecheck.runs.jsonl`). `npm run typecheck` runs the two at once.

**The gate stops at ci.yml's first build; `npm run test:fleet:postbuild -- <ref>` runs the rest.**
From a clean `npm ci` it runs that build and every ci.yml step after it — the manifest, tree-shake
and React-free checks, both consumer smokes, the site builds — reading the list from ci.yml through
`scripts/lib/ci-steps.mjs`, as the gate does. It builds in a node tree of its own
(`weasel-postbuild`), so no test run shares its `dist`. It took 3.4–5.0 min wall on 2026-10-21; run it
beside `test:fleet` before merging any branch.
`npm run test:fleet:matrix -- <ref>` runs that whole ci.yml job under each matrix Node the fleet
doesn't (22), in its own `weasel-node22` tree; it took 13.9 min wall on 2026-10-21, so run it before
merging a branch that touches dependencies, build tooling, or anything loaded through a native module.
