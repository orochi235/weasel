- tool's `readBy` not cleared by a run no tool was live for (A): fixed 6b85ad70d4. The reader is now recorded when the panel builds the held run's form, not on every `params` read. That also fixes a related case in the same root: a cursor, enabled, or preview read under another tool used to move the reader, so a panel edit wrote into that tool.
- `useToolOptionValues` throws outside a `DepRegistryProvider`, though documented as a no-op (B): fixed 4bfbe4245c
- `steppedOption` steps an off-grid value backwards when the move is smaller than the snap (B): fixed 1f2d4e18d8

Checks:
- `npx vitest run --maxWorkers=1` on packages/routing/src/tools/toolOptions.test.ts: pass (21)
- packages/routing/src/tools/tuneToolOptions.test.ts: pass (7)
- packages/routing/src/tools/useToolOptionValues.test.tsx (new): pass (2)
- toolOptions.pbt, toolOptions.shrunk, toolOptionSteps, toolOptionSteps.pbt, toolOptionSteps.shrunk, toolOptionShare, lastOperation, lastOperation.ongoing, ActiveToolOptionsBar, SceneCanvas.toolStyle, DiagramView.sequenceTools, useWeightTool, stickyStyle, pathEditTools.canvas, brushSize, and apps/draw LastOperation.tools: all pass
- `npm run checks:gate`: all 33 passed
- `npm run lint -w @weasel-js/routing`: not run, because the package has no lint script. The root `npm run lint` in the gate passed.
- `npm run check:changesets`: OK, with no warnings on the three new changesets

tally: 3 of 3 fixed, 0 extra fixed