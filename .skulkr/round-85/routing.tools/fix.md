- `findConflicts` keys `{ kindOf }` predicate targets by the wrapper object, not the function (A): fixed 90277ce99a. The old test asserted the opposite, against the function's own doc, so I rewrote it.
- `disengageHotkey` with no hold of its own pops a tool held on its key (A): fixed 65411ac808. Strict call: with no hold of its own it now releases nothing. Recorded in `docs/unruled.md` in a6d183b30f.
- Holds made through `engageHotkey` survive the unmount of the `useTools` that made them (A): fixed 42b9d6aa80
- `ToolsSlot` republish moves an older canvas to newest, so it takes the scoped slot (A+B): fixed f2d9aaed97
- A tool redefined under its id while live never gets `onActivate`, and the old one never gets `onDeactivate` (A): fixed 31c2ecc66d. Definitions are compared by their `onActivate`/`onDeactivate` functions, so a rebuilt wrapper alone causes no churn.
- `toolGaps` reports "no cursor" for a tool with `Tool.cursor` but no `def` (A): fixed 378d19552b
- A `times` step never moves an option off 0 (A): fixed 4156d6560b. This settles the open line in `docs/unruled.md` with a strict call: the step falls back to `leaf.step`, else 1, from 0 and from below 0. An infinity stepped back with no bound now goes to the largest double.
- A `times` step never moves an option off 0, and an infinity with no `max` is stuck (B): duplicate of the A finding above, fixed in 4156d6560b
- A panel value clamped onto the leaf's default is dropped (B): fixed 4915a0098c
- `useTools` throws mid-life when the initial `active` tool leaves the registry (B): fixed 7d3666c79c. The check now runs on mount only.
- The shortcut sheet never lists keys a tool binds itself (B): not a defect. `describeShortcuts` is documented as listing the keys `actions` bind, from an actions registry's `list()`. Tool-bound keys belong to the tool and are live only while it is, outside any actions scope.

Extra: none. Commit 8b8d2b285e only shortened five of my changeset titles to under 140 characters.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own: pass. Files run: `routing/reflection/*` (119), `useTools.test.tsx` (10), `core/src/tools/useTools.test.ts`, `path-tools` `usePenTool.preview.canvas.test.tsx`, `toolsScope.test.tsx` (3), `useToolLifecycle.test.tsx` (1, new), `toolGaps.test.ts` (5), `toolOptionShare.test.ts` (8), `toolOptions.test.ts` (20), `toolOptions.pbt.test.ts` (3), `toolOptions.shrunk.test.ts` (5), `toolOptionSteps*.test.ts`, `tuneToolOptions.test.ts`, `useShapeBuilderTool.test.tsx`, `useWarpTool.test.tsx` and `SceneCanvas.heldTool.test.tsx`. No browser tests touched.
- `npm run checks:gate`: pass, "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/routing`: fail. The package has no `lint` script ("Missing script"). Instead, eslint on every changed `.ts`/`.tsx` file: pass. The gate's `npm run lint` also passed.
- `npm run check:changesets`: pass ("OK — 1299 changeset(s)"); none of my changesets warns after the title fix.
- Tree clean except `.skulkr/`.

tally: 10 of 12 fixed, 0 extra fixed