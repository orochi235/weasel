# The fleet

How branch and `main` runs on the fleet work, past the rules in `CLAUDE.md` ("Worktrees and the
fleet"). For anyone running or reading a fleet job.

**On a branch, a fleet run tests only what the branch reaches.** The test files whose imports lead to
a changed path run, and the gate always runs whole; `main` and a bare commit run everything, and so
does `--full`. A change to a manifest, a tsconfig, a setup file, or anything `vitest.config.ts` loads
runs everything too — the `triggers` list there. A file read at build time rather than imported,
such as an icon definition a plugin generates from, selects nothing on a branch and is caught only by
the full run on `main` after the merge. Add such a path to `triggers` once it has slipped through.

**Draw is served from `.claude/worktrees/view`, a detached checkout of `main`**, so edits to the
main checkout don't reload the browser tab mid-session. A local `pre-push` hook runs
`scripts/advance-view.mjs` on every push to `main`, moving it to the pushed commit (and running
`npm ci` and restarting draw when the lockfile changed); `npm run view:advance` does the same by hand.

**`npm run dev:fleet -- draw forge` serves dev servers from a fleet node instead of this machine.**
It installs into one scratch tree there (`weasel-dev`), runs the apps as an onto service, prints each
address, and syncs every edit made here until Ctrl-C stops the servers; `--drop` removes the tree. Drive
it headless from here with chrome-devtools or Playwright by the printed IP: headless Chrome resolves no
`.local` names. `DRAW_E2E_URL=http://<ip>:33452 npm run test:e2e:draw` runs draw's e2e suite against it.

**The fleet also runs the `gate` project**: the typecheck, lint, and `check:*` steps CI runs,
read from `ci.yml` by `scripts/ci-checks.gate.ts`, each as a test. CI only runs on a push, so
this is what says a commit would fail there. `npm run test:gate` runs it here, in about two
minutes; run it before merging a branch.

**The gate stops at ci.yml's first build; `npm run test:fleet:postbuild -- <ref>` runs the rest.**
From a clean `npm ci` it runs that build and every ci.yml step after it — the manifest, tree-shake
and React-free checks, both consumer smokes, the site builds — reading the list from ci.yml through
`scripts/lib/ci-steps.mjs`, as the gate does. It builds in a node tree of its own
(`weasel-postbuild`), so no test run shares its `dist`. It took 3.4–5.0 min wall on 2026-10-21; run it
beside `test:fleet` before merging any branch.
`npm run test:fleet:matrix -- <ref>` runs that whole ci.yml job under each matrix Node the fleet
doesn't (22), in its own `weasel-node22` tree; it took 13.9 min wall on 2026-10-21, so run it before
merging a branch that touches dependencies, build tooling, or anything loaded through a native module.
