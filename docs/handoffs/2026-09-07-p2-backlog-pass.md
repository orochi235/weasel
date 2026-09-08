# Second and third passes through `docs/TODO.md` — the P2s

**State at hand-off:** `main`, working tree clean, **31 commits unpushed** and
no push approved. `git log --oneline @{u}..HEAD` lists them.

Pick the next item from `docs/TODO.md`. Its "High-priority index" is a
hand-maintained copy of claims further down, so fix both or fix neither.

## Verified on the tree as it stands

`tsc --noEmit`, `npm run lint`, `npm run lint -w @weasel-js/labkit`, `npm test`
(870 files, 9561 passed, 0 failed), `npm run test:stories` (338 passed),
`npm run build`, `check:bumps`, `check:manifests`, `check:frame-loops`,
`check:test-projects`, `test:smoke:consumer`. All green.

The visual suite has not been run since the second pass began. Changes that
could move a `<canvas>` baseline: shared layer effect passes, nullable text
fill, and the repaint tripwire now firing on chrome-state changes.

## Decisions here that are not in the code

**A nested `WeaselProvider` no longer shares its parent's registry object.**
`ActionsProviderIfRoot` mounts an `ActionsScope`, so identity differs by
design while the store beneath is one. `WeaselProvider.test.tsx` used to assert
the identity; it now asserts the sharing.

**Suppression is a per-scope mute, not a tombstone on the registrant stack.**
A tombstone on a shared stack hides the action from every canvas, which is the
same bug in a new mechanism. `unregister` keeps its old meaning.

**`sceneFromJSON` now builds an empty scene and calls `loadState`.** One reader
rebuilds the layer stack instead of two, because `createScene` mints system
layers only and cannot restore a user layer.

**labkit config migration is a lazy read-time fill, not a versioned rewrite.**
Migrations in `state/document.ts` run over raw JSON with no access to
instrument schemas, and flat→nested is a per-instrument schema change rather
than a change to labkit's persisted format. The fill keeps keys the schema no
longer names, so an author mid-rename loses nothing.

**The contrast entries were deleted, not fixed** (first pass). One contrast
line survives in
`docs/superpowers/specs/2026-08-25-labkit-visual-language-design.md` — it
records work that shipped, so it is not a backlog item.

**labkit peers `@weasel-js/core` exactly, which is breaking for consumers.**
`package-lock.json` was hand-edited (two lines, mirroring `packages/svg`'s peer
shape) because the lock is stale on `main` at `1.4.0-pre.0` while the manifests
are at `1.4.2`.

**`kit:text` still reports `filled: true` under `data.fill: null`.** A text
node's silhouette is its line boxes, not its glyph ink.

**A multi-select layout drop places children one at a time.** A grouped
`commitDrop(container, children, dragged[])` was rejected because it breaks
every existing strategy to express what threading the child list already gives
them.

## Traps these passes hit

**A subagent will open a visible Chrome unless the prompt forbids it.** Agents
do not inherit the headless rule. Every dispatch needs an explicit no-browser
clause, and `ps -ax -o pid,command | grep "Google Chrome" | grep -E
"--headless|--remote-debugging-port|--enable-automation"` is worth a sweep
before finishing.

**Concurrent agents in one checkout interleave in shared files.** Give agents
disjoint file sets, fence them off `docs/TODO.md` and `.changeset/`, and have
them leave work uncommitted for the controller to commit — otherwise separating
the diffs means splitting by hunk and staging with `git apply --cached`.

**vitest transpiles without typechecking.** Two new test files ran green while
`tsc --noEmit` rejected them — `NodeId` is branded, and `scene.add` wants an
explicit `kind`. Run the root typecheck before believing a new test file.

**A targeted test run will not catch a public-identity change.** The action
scope broke `WeaselProvider.test.tsx`, which no agent had reason to run. Only
the full suite found it.
