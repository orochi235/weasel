CurveEditor's own layer shares the `'function'` id with a child FunctionLayer, so keys meant for the child move CurveEditor's anchor (A): fixed 976b1767de. I took the general fix: a layer now tells which keys are its own by its group element, not by id. The changelog already allows two layers to share an id. `KeyDownArgs` gains `group`, so that changeset is `minor`.

A strict-function anchor gets dragged past a neighbor that sits closer than two gaps (A+B): fixed 9741e757db

The keyframe layer's default `formatX` rounds to an integer, so marks on [0, 1] share a name (A): fixed c4b3f6f614. Both layer types now use one shared `formatCoord`.

With `history={false}` the plot leaves the tab order, so a layer's keys at the plot never arrive (A): fixed 02b55a0501

A `'pinned-x'` endpoint is styled as immovable even though it drags in y (A+B): fixed 52a2b0c92c

A long press can't delete an anchor because its pointerdown already started a drag (A): fixed d3f02cd4e1. This needed a behavior call nobody had made, so I made it and recorded it in `docs/unruled.md`: a context menu during a drag cancels the drag, then goes to the layers.

Two layers editing on one key press record two undo steps (B): not a defect. Commit 678da697f9 made this deliberate, and a test in `LayeredCurveEditor.editProtocol.test.tsx` pins it: "records an undo step for each, so one undo reverts only the last".

[r58-16] A key one layer commits without preventing default is undone together with the next layer's edit (carried): not a defect (no longer applies). Commit 678da697f9 folds the earlier edits into the next layer's undo snapshot, so each edit gets its own step.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `functionAnchorEdits.test.ts`: pass (19)
  - `CurveEditor.pinnedLook.test.tsx`: pass (2)
  - `createKeyframeLayer.names.test.tsx`: pass (1)
  - `LayeredCurveEditor.focus.test.tsx`: pass (1)
  - `CurveEditor.childLayerKeys.test.tsx`: pass (1)
  - `CurveEditor.longPress.test.tsx`: pass (1)
  - Related files:
    - `CurveEditor.test.tsx`: pass (50)
    - `createKeyframeLayer.test.tsx`: pass (34)
    - `CurveEditor.arrowKeys.test.tsx`: pass (7)
    - `CustomLayer.test.tsx`: pass (8)
    - `CurveEditor.history.test.tsx`: pass (11)
    - `CurveEditor.hold.test.tsx`: pass (13)
    - `CurveEditor.cancel.test.tsx`: pass (2)
    - `LayeredCurveEditor.editProtocol.test.tsx`: pass (12)
    - `LayeredCurveEditor.stories.test.tsx`: pass (3)
  - Each new test was also run against the original code first, and failed there.
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/ui`: fail ("Missing script: "lint""). The package has no lint script; the root `npm run lint` passed inside the gate.
- `npm run check:changesets`: pass ("OK — 104 changeset(s)")
- The tree is clean.

tally: 7 of 10 fixed, 0 extra fixed