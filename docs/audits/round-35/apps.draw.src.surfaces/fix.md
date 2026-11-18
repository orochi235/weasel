- Offset's distance resets when the popover closes or the asset moves (A): not a defect. `OffsetSlider` resets its distance to `DISTANCE.default` after every commit on purpose: the new outline is selected, so the next offset starts from it (`PathCommands.tsx`, the `onChange` comment). A drag or a key step commits, so the slider shows the default on reopening whether or not the popover kept its state.
- `useEditorSurfaceHost`'s memo misses on every render because `setSimplifyTolerance` is a new function each time (A): fixed 620a3464c7 (`useSimplifyTolerance`'s setter is now a `useCallback` over the stable `values`).
- A command-row asset hidden from its panel's × has no View-menu toggle to bring it back (B): fixed 7a41b92c2a. I made the strict call: a command-row asset's panel has no hide button, and it is recorded in `docs/unruled.md` under "Audit round thirty-five". It applies to the whole command row, Undo and File included, not only `pathCommands` and `fillets`. Listing those assets in the View menu was the alternative.
- The 5→6 migration skips `atEnd` and leaves a stale `corners` in a row that already holds `fillets` (B): fixed 998e1c18bb. Both are handled now.

No extra defects found. No changesets: these change only the draw app, which is not a published package, and earlier draw-only commits carry none either.

Checks:
- `npx vitest run --maxWorkers=1 apps/draw/src/surfaces/prefsMigration.test.ts`: pass (7)
- `npx vitest run --maxWorkers=1 apps/draw/src/ui/PathCommands/PathCommands.test.tsx`: pass (5)
- `npx vitest run --maxWorkers=1 apps/draw/src/surfaces/surfaces.test.tsx`: pass (7)
- `npx vitest run --maxWorkers=1 apps/draw/src/surfaces/chromeToggles.test.tsx`: pass (4)
- `npm run typecheck:packages -- draw`: not applicable ("no packages/<name>/tsconfig.json for: draw"); `npm run typecheck` instead: pass (exit 0)
- eslint on the 6 changed files: pass
- `npm run check:size`: pass ("no file or function grew past its cap")
- `npm run check:changesets`: pass ("OK — 1676 changeset(s)")
- Tree clean.