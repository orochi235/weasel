# Audit round 47 — editing.presets

Note: the brief names frozen commit 44e73a944bea29d4d56fc7883fa302daec48ecf1, which does not exist in this
clone (`git rev-parse` → bad object). The tree read is HEAD 782733b19c54308edbc779a6bdfcae2ca398cf65.

No defects found. Leads checked and cleared:

- `selectPreset` lists areaSelect/lassoSelect/clearSelection as `actions` while `selectToolsOfferedPreset`
  lists them as `toolActions`: `useFeatureBindings` dedupes the pool by id, so nothing registers twice.
- Group entry's `pickHit` uses `ctx.pick.bestIn`, not `selectTool.pickBest`: ruled in docs/unruled.md
  (topmost hit, not `pickBest`, outside the select tool's own pick).
- `clipboardPreset`'s claim that `ingest` answers alone when both are on: `useActionSet` maps
  `clipboard.pasteEvent` → `ingest` and leaves it unregistered.
- `swapPreset` needs `canSwap` in `requires`, but `swappable` treats the dep as optional; `swap` is in
  `FEATURE_PRESETS`.
- `selectRotates: false` strips rotatePreset's ambient `rotate` binding and the rotation handle chrome.
- `SHAPE_TOOLS` / `SELECT_TOOLS` name exactly the ids the offered presets build (rect, ellipse, line,
  polygon, star; select, lasso), and every shape tool binds `INSERT_REPOSITION_BINDING`, so
  `insertPreset`'s tool actions all register when a tool mounts.
- Build context readers (`pick.*`, `adapter()`, `selectTool()`) are live thunks, so nothing goes stale
  between rebuilds.

## Files read
packages/editing/src/presets/arrange.ts
packages/editing/src/presets/booleans.ts
packages/editing/src/presets/composites.ts
packages/editing/src/presets/edit.ts
packages/editing/src/presets/ingest.ts
packages/editing/src/presets/insert.ts
packages/editing/src/presets/pathfinder.ts
packages/editing/src/presets/select.ts
packages/editing/src/presets/selection.ts
packages/editing/src/presets/selectionChrome.ts
packages/editing/src/presets/tools.ts
packages/editing/src/presets/transform.ts

<!-- done: 0 findings, files read: 12 -->
