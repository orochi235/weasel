- Negative-spacing repeat guide line drawn away from its copies (A+B): fixed a508ce087e
- Handle press takes the first handle in reach, not the nearest, so the center can't be grabbed beside a short step (B): fixed 512381ae24. This replaces the old guide.test expectation that a press on the center dot takes the step. The draw order is unchanged, so on an exact tie the press still takes the handle drawn on top.
- Angle knob reach ignores the copies of a nested symmetry group (A+B): fixed 074414972d. `reachFrom` now carries each nested group's copies, composed through any groups nested inside it, onto its descendants' boxes.
- Bake uses the 'document' world pose while the live copies use 'shown' (A): not a defect. Scroll offset is a translation shared by the center and the leaves. A turn or reflection about center+s applied to leaf+s is the document-space copy shifted by s, and bake stores its copies in document space under the same frame, so they show where the live copies drew.

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1 packages/symmetry/src/guide.test.ts`: pass (17)
- `npx vitest run --maxWorkers=1 packages/symmetry/src/controller.test.ts`: pass (31)
- `controller.pbt.test.ts`: pass (6). `controller.long.pbt.test.ts`: pass (1). `bake.test.ts`: pass (2).
- `npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run check:changesets`: "OK — 139 changeset(s)." The first run failed on a title over 140 characters; I shortened it and squashed that into 512381ae24.
- `npm run lint -w @weasel-js/symmetry`: the package has no `lint` script ("Missing script"). The root `npm run lint` inside the gate passed.

tally: 3 of 4 fixed, 0 extra fixed