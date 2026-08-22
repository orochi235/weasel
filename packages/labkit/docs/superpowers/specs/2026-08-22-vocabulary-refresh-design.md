# Vocabulary refresh: Lab / Experiment / Workspace / Trial — design spec

**Date:** 2026-08-22
**Status:** Draft
**Package paths:** all of `src/`, plus `docs/`
**Depends on:** the versioned lab document — the rename changes a persisted
field name, and ships as that document's migration 1 → 2.

`Workspace` names two different things in labkit: the area tiles are laid
out in, and one tile. This gives each level its own word.

## The model

- **Lab** — the class. A lab's definition in the repo (Drag Lab, Weasel Lab).
- **Experiment** — the instance. One persisted session of a Lab, everything
  under one `storageKey`. A file you open, edit and save.
- **Workspace** — the area inside an experiment that trials are laid out in.
  One per experiment.
- **Trial** — one tile: an instance of an instrument with its own state,
  config, view and undo stack.

Side-by-side tiling then reads as what it is: two trials of the same
experiment.

## The rename

`<Workspace id>` renders exactly one tile — it looks up one record and
mounts one instrument inside `<WorkspaceChrome>`. `WorkspaceGrid` lays those
out. So the tile takes the new word and the grid takes the freed one:

| today | becomes |
|---|---|
| `<Workspace id>` | `<Trial id>` |
| `WorkspaceProps`, `WorkspaceRecord`, `WorkspaceChrome`, `WorkspaceOp`, … | `Trial*` |
| `WorkspaceIdProvider` / `useWorkspaceId` | `TrialIdProvider` / `useTrialId` |
| `WorkspaceGrid` | `Workspace` |
| `useExperimentState` | `useTrialState` |
| `LabStoreState.workspaces` | `.trials` |
| `addWorkspace`, `updateWorkspaceState`, … | `addTrial`, `updateTrialState`, … |
| `.lk-workspace`, `.lk-workspace-tile` | `.lk-trial` |
| `.lk-workspace-grid` | `.lk-workspace` |

Roughly 350 identifier occurrences across about 30 source files, five CSS
classes, and the export surface in `src/index.ts`.

`useExperimentState` is the rename that matters most: it is per-tile, so its
current name asserts the exact conflation this spec removes. `Experiment`
survives as the word for a `storageKey`'s worth of state, which is what the
versioned lab document holds.

## Blast radius stops at labkit

Nothing outside the package renders a labkit workspace. `apps/draw`'s two
matches are an npm-workspace path comment and a comment about
`.wd-canvas-host`; neither refers to this API.

The rename also settles a collision that already exists. weasel's own
`CLAUDE.md` defines *workspace* as the striped area surrounding the rendered
page — an area things sit in. After this, labkit's `Workspace` means an area
things sit in too, and the two usages agree.

## Persistence

`LabStoreState.workspaces` is persisted. Renaming the field without a
migration orphans every saved lab, which is why this depends on the
versioned document rather than shipping first: the rename *is* migration
1 → 2, renaming `doc.workspaces` to `doc.trials`. No other persisted shape
changes — a trial record's own fields keep their names.

Storage keys are unaffected: the versioned document has already collapsed
`lk:<storageKey>:workspaces` and the rest into one key by the time this
lands.

## Sequencing

One commit, mechanical, with the migration written first so a lab saved
before the rename opens after it. Splitting it per-directory leaves the
package in a state where both vocabularies are live, which is the thing the
refresh exists to prevent.

Docs are part of the commit: `docs/RECIPES.md`, `docs/AGENTS.md`, the
per-directory `AGENTS.md` files under `src/`, and `docs/IDEAS.md`, whose
vocabulary entry this spec supersedes. The older specs under
`docs/superpowers/specs/` are historical and are left as written.

## Not in scope

**Sweep** — a structured set of trials generated from a parameter range or
recipe — is named in `IDEAS.md` and stays there. It is a feature, not a
rename, and nothing in this work needs the word.

## Testing

The existing suite is the test: it exercises every renamed symbol, and it
passes unchanged except for the renames themselves. Two additions:

- A document at version 1 with `workspaces` opens as trials.
- The public export surface has no `Workspace*` symbol that means a tile,
  and no `Experiment*` symbol that means anything per-tile.
