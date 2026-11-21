# The fleet

How branch and `main` runs on the fleet work, past the rules in `CLAUDE.md` ("Worktrees and the
fleet"). For anyone running or reading a fleet job.

**On a branch, a fleet run tests only what the branch reaches.** The test files whose imports lead to
a changed path run, and the gate runs all but the slow checks whose inputs the branch leaves alone
(below); `main` and a bare commit run everything, and so does `--full`. A change to a root manifest or
tsconfig, a setup file, or anything `vitest.config.ts` loads runs everything too — `TRIGGERS` in
`scripts/lib/fleet-triggers.mjs`, whose test fails on a file the config loads that no glob there covers
and no test imports, and on a file a glob there covers that nothing loads. A plugin only a dev server
or a build loads, and any test file, select only the tests that import them. A test that lists or globs
the tree instead of importing it, such as ui's check that only quarantined modules name an `UNSTABLE_`
API, runs on every branch (`TREE_READERS` beside the triggers, held to the tree by the same test). A trigger one package owns — its `package.json`, a `tsconfig`, its vite or vitest
config — runs that package's tests and its dependents' instead (`SCOPED` beside it), and so does a lockfile
change that touches only workspace entries, such as a version bump; one that changes an external
package runs everything. A file read at build time rather than imported,
such as an icon definition a plugin generates from, selects nothing on a branch or in a batch run,
which selects the same way; only CI's run of every project on the push to `main` (`.github/workflows/ci.yml`)
catches it. Add such a path to `TRIGGERS` once it has slipped through.
A changed path is one the branch adds to local `main`, or to `origin/main` when that is newer: the
node builds on the pushed merge-base, but unpushed `main` commits are not the branch's changes.
`--since <ref>` selects from what the branch adds past `<ref>` instead, for a branch stacked on one
whose own run was green.

**Every failure prints one `fleet-fail:` line the moment it happens**, on a line of its own, once, while
the run goes on: `fleet-fail: <project> <file> :: <test name>` for a test (a browser instance's project
reads `browser:chromium`), `fleet-fail: <project> <file> :: (file)` for a file that failed with no
failing test, such as one that did not load, `fleet-fail: gate <npm script>` for a gate check, and
`fleet-fail: postbuild <step>` for a postbuild step. Point a Monitor at `fleet-fail:` in the run's log
and start on the first one; the summary at the end lists the same failures. `scripts/vitest-fleet-fail.mjs`
prints the test ones.

**Draw is served from `.claude/worktrees/view`, a detached checkout of `main`**, so edits to the
main checkout don't reload the browser tab mid-session. A local `pre-push` hook runs
`scripts/advance-view.mjs` on every push to `main`, moving it to the pushed commit (and running
`npm ci` and restarting draw when the lockfile changed); `npm run view:advance` does the same by hand.

**`npm run dev:fleet -- draw forge` serves dev servers from a fleet node instead of this machine.**
It installs into one scratch tree there (`weasel-dev`), runs the apps as an onto service, prints each
address, and syncs every edit made here until Ctrl-C stops the servers; `--drop` removes the tree. Drive
it headless from here with chrome-devtools or Playwright by the printed IP: headless Chrome resolves no
`.local` names. `DRAW_E2E_URL=http://<ip>:33452 npm run test:e2e:draw` runs draw's e2e suite against it.

**The visual baselines are CI's Linux captures, and every fleet node is a Mac.** Anything a page
draws per platform differs on a node: menus print shortcuts as `⌘⇧D` on a Mac and `Ctrl+Shift+D` on
Linux, which failed `hud-context-menu` on studio and teitou alike by 3.84% and 4.64% until its spec
called `reportLinuxPlatform` (`tests/visual/diff.ts`) (2026-11-03). A spec whose demo shows shortcuts
calls it before `goto`.

**keiei takes no weasel jobs** (`onto set keiei --refuse repo:orochi235/weasel`, 2026-10-29). With 24 GB
and 7–11 GB of swap it failed forge's timeline test in five full runs on 2026-10-20, where the other nodes
pass it in 20–44 s. `onto set keiei --allow repo:orochi235/weasel` takes it back.

**The fleet also runs the `gate` project**: the typecheck, lint, and `check:*` steps CI runs,
read from `ci.yml` by `scripts/ci-checks.gate.ts`, each as a test. CI only runs on a push, so
this is what says a commit would fail there. `test:fleet` runs it with everything else, so read its
results from that log. It runs typecheck, lint and every check at once, so it runs only inside a
fleet run. `npm run checks:gate` runs the same list, read the same way, outside vitest, for a job
already on a fleet node (a skulk fixer); it skips nothing for an unchanged input.

**On a branch run the gate skips `check:needs`, `check:first-publish`,
`audit:jsdoc` and `check:test-projects` when the branch changes none of the paths each reads**,
listed in `scripts/lib/gate-inputs.mjs`; the log shows each as skipped, with a `gate: skipped` line
saying why. A change to ci.yml, the gate, `scripts/lib/`, the root manifest, the lockfile or a tsconfig runs
them all. `check:test-projects` asks only whether the branch adds or deletes a test file, since an
edit to one cannot change which project collects it. A script that starts reading a new path needs
that path added there, or a branch changing only it will skip the check; CI still runs it on every
pull request and push to `main`.

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

**`npm run sweep:controls -- [--only id,id]` runs the control sweep on a node with a browser** (`onto do --gui`,
tree `weasel-control-sweep`): it operates every demo control and lists each that changes nothing. A nightly
audit runs it only when started with `--sweep`; how it judges a control is in skulkr's README, "The control sweep".

**The gate stops at ci.yml's first build; `npm run test:fleet:postbuild -- <ref>` runs the rest.**
From a clean `npm ci` it runs that build and every ci.yml step after it — the manifest, tree-shake
and React-free checks, both consumer smokes, the site builds, draw's e2e suite — reading the list from ci.yml through
`scripts/lib/ci-steps.mjs`, as the gate does. It builds in a pooled tree no test job holds, so no
test run shares its `dist`. It took 3.4–5.0 min wall on 2026-10-21.

**A batch runs `npm run test:batch -- <ref>`**: `test:fleet` and `test:fleet:postbuild` at once, the
postbuild alongside, with one exit status and a closing `test-batch:`
line naming which failed. Either failing stops the other, onto jobs included.

**A rerun starts with what failed last time, and stops if it fails again (2026-11-20).** `test:fleet` keeps each
branch's failed test files in the repository's common git directory (`scripts/lib/fleet-first.mjs`) and lists them in
the next run's tree marker. There the sequencer (`scripts/vitest-first-sequencer.mjs`) runs them first, and the
`fleet-fail` reporter cancels the run the moment one fails again, printing one `fleet-abort:` line; the other half's job
is stopped with it. A passing run clears the branch's list.

**onto places every part, and picks its tree.** The browser project runs as its own job (suite scope `browser`)
beside a job running the rest (scope `full-rest` or `branch-rest`), and the postbuild as a third; no part is pinned to a
node or names a tree (2026-11-20). A job with no `--in` runs in one of onto's pooled trees, `weasel-wt1` to `weasel-wt6`
on each node, and onto refuses an `--in` naming a tree the node lacks: an ad hoc tree is made on purpose with
`onto sync --in`, as `dev:fleet` makes `weasel-dev`. Only a `--spread` run stays on the plain `weasel` tree. A part bound at launch to the node that looked best then waited hours there once that node filled,
while others sat idle. The browser part's lines in the log start `browser| `; `WEASEL_FLEET_SPLIT=0`, or naming a node,
keeps the suite one job. On 2026-11-19 the same 415 browser files took 746 s on an idle teitou and 1,239 s on one
someone was using: an idle-GPU node is faster, but only onto can wait for one fairly, and `onto test` has no `--gui`
placement hint yet.
