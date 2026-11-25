fixed d-collapse-under-lock: Shift-press that reads as replace still defers under `extendClickLocked`, so release collapses (A+B) — fixed a2f24c8b07
fixed deferred collapse uses the release's modifiers, so Shift/Cmd pressed before release toggles instead of collapsing, lock or not (B) — fixed 3d09d1699f
fixed Alt-drag clone bindings ignore `move.dragThresholdPx` (A+B) — fixed 51b313321d. The "lifecycle options" in A's title are not a defect: `label`/`transient`/`onRunStart`/`onRunEnd` describe the move run, and putting a move's label or callbacks on a clone would be wrong. The `MoveOptions.dragThresholdPx` doc in core now names the clone bindings too.
fixed `pickTolerance` documented as silhouette-only though the `'aabb'` picker reads it around a derived route's box (A) — fixed 322983d4aa. This was a doc defect, so no test could fail before the fix. The new test pins the behavior the doc now describes: a straight route under `'aabb'` is hit within `pickTolerance`.
fixed `useImageTool` accepts `share` and drops it (A) — fixed 2590d30f32. `UseImageToolOptions` now takes only `behaviors` from `InsertToolOptions`. A `@ts-expect-error` test failed typecheck before the fix. The changeset is `major` + `breaking fix`, because code that passed `share` stops compiling. Sweep: every other insert tool (rect, ellipse, line, polygon, star, pencil, text, sticky) honors `share`.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own: selectionContributions.test.ts pass (22), useSelectTool.test.ts pass (35), useSelectTool.derived.test.tsx pass (5), useImageTool.test.tsx pass (5), insertToolOptions.test.ts pass (6), useSelectTool.deep.test.tsx pass (8); also useSelectTool.groups.test.tsx pass (12) and useSelectTool.enter.test.tsx pass (15) after the press-mods change
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run check:changesets`: pass ("OK — 2235 changeset(s)")
- `npm run lint -w @weasel-js/editing` / `-w @weasel-js/core`: neither package has a `lint` script ("Missing script: lint"). Root `npm run lint` passed inside the gate, and eslint on every touched file passed.
- Unrun: none (no browser tests touched)
- Tree clean