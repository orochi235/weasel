---
'@weasel-js/routing': patch
'@weasel-js/core': minor
'@weasel-js/ui': patch
'@weasel-js/path-tools': patch
'@weasel-js/geom': patch
---

<!-- bump-approved: minor: maintainer — 1.15.0 release requested 2026-10-31 -->

An action can declare its params as a form, `Action.params` (a `@weasel-js/prefs` group of labels, ranges, steps,
and defaults). An immediate run of such an action that commits one history entry becomes the actions tree's last
operation, read with `useLastOperation()` / `useLastOperationStore()` (or `lastOperationOf(registry)`). Its
`adjust(patch)` undoes that entry, puts back the selection the run started from, reruns the action with the patch
over the values it used, and keeps the new entry in place of the old one, so the history still holds one entry. Any
other history step, an undo or redo, or `dismiss()` clears it. The values last used become the action's params for
the rest of the session, under any tuning. Core publishes a `selectionSnapshot` dep that captures the node selection
and the anchor selection together, which the rerun restores.

`@weasel-js/ui` adds `<LastOperationPanel>`, which draws the last operation as a form titled with the command's label,
adjusting it on each change and dismissing it from its close button; it renders nothing while there is none.

`bridgePaths` and `bridgeAnchors` declare their Tension (`BRIDGE_PARAMS`), `resamplePath` its count, spacing, corners,
and tolerance (`RESAMPLE_PARAMS`), and `addExtremeAnchors` a new Turns param (`ADD_EXTREMES_PARAMS`). `resamplePath`
is now an immediate command committing one entry, where it was an ongoing action previewed through `begin`: code
driving it with `useOngoingAction` must trigger it instead. `addExtremeAnchors` takes `params.axes` — `'xy'` (the
default), `'x'`, or `'y'` — and geom's `segmentExtremaTs` and `addExtremaAnchors` take the same choice as a last
argument (`ExtremaAxes`).
