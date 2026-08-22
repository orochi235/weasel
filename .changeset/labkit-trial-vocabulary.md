---
'@weasel-js/labkit': patch
---

Rename a lab's tile from workspace to trial, and the area they sit in to workspace.

`Workspace` named two different things: one tile, and the grid the tiles were
laid out in. A tile is now a **trial** — `<Trial>`, `TrialRecord`,
`TrialChrome`, `TrialIdProvider` / `useTrialId`, `addTrial` /
`updateTrialState` / … — and the grid takes the freed word, so `WorkspaceGrid`
is now `<Workspace>`. `useExperimentState` is `useTrialState`: it was always
per-tile, which is the conflation this removes. `Experiment` keeps its meaning
as one `storageKey`'s worth of state — what the lab document holds — so
`<SingletonExperimentProvider>` is unchanged.

This is a breaking rename of most of the lab runtime's public surface. Every
`Workspace*` symbol that meant a tile is gone; there are no aliases.

CSS classes move with it: `.lk-workspace` (the tile chrome) is `.lk-trial`,
`.lk-workspace-tile` is `.lk-trial-tile`, and `.lk-workspace-grid` is
`.lk-workspace`.

A saved lab opens unchanged. The document format goes to version 2 and its
migration renames `workspaces` to `trials`; a version-1 document, and a
pre-document lab still on the four legacy keys, both fold forward on load.
