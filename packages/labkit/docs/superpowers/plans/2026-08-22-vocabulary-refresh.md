# Vocabulary refresh — implementation plan

**Spec:** `docs/superpowers/specs/2026-08-22-vocabulary-refresh-design.md`
**Branch:** `feat/labkit-vocabulary-refresh`

One commit. The migration is written first so a lab saved before the rename
opens after it.

## Decisions the spec left open

**Directory layout.** `src/workspace/` becomes `src/trial/` — every file in it
is the tile. `src/lab/WorkspaceGrid.*` becomes `src/lab/Workspace.*` and stays
in `src/lab/`, next to `Lab` and `LabShell`: the lab shell holds the workspace.

**The two `.lk-workspace` classes do not merge.** The spec's table maps both
`.lk-workspace` and `.lk-workspace-tile` to `.lk-trial`, but they are nested
elements — the tile wrapper (grip + body) contains the trial chrome. They
become `.lk-trial-tile` and `.lk-trial`.

**`migrateV0toV1` stops calling `normalizeDocument`.** `normalizeDocument`
coerces to the *current* shape and stamps `CURRENT_DOCUMENT_VERSION`; once
that shape is v2 it would silently drop `workspaces` from a document labelled
version 1, and `migrateV1toV2` would then rename an absent field. v0 → v1 gets
its own inline coercion against v1 field names.

**`SingletonExperimentProvider` keeps its name.** It is per-`storageKey`, not
per-tile — an experiment with exactly one trial. `ExperimentStateHandle` does
rename, to `TrialStateHandle`: it is what the per-tile hook returns.

## Steps

1. `git mv` the directory and the grid files.
2. Scripted identifier rename over `src/` and `docs/{AGENTS,RECIPES,IDEAS}.md`,
   ordered through placeholders so `WorkspaceGrid` → `Workspace` does not
   collide with `Workspace` → `Trial`, and the legacy bucket literal
   `'workspaces'` survives untouched.
3. `CURRENT_DOCUMENT_VERSION = 2`; add `migrateV1toV2` renaming
   `doc.workspaces` to `doc.trials`; make `migrateV0toV1` self-contained.
4. Two tests: a version-1 document with `workspaces` opens as trials, and the
   export surface has no tile-meaning `Workspace*` and no per-tile
   `Experiment*`.
5. Docs, then `npm test` and `tsc -p tsconfig.lib.json`.

## Traps

- `labStorageKey(key, 'workspaces')` and `LEGACY_BUCKETS` name the v0 keys.
  They are history and never rename.
- Test fixtures that assert a *v1* document keep `workspaces`; fixtures for
  the current shape become `trials`.
