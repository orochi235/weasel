- useConnectorTool's memo leaves out `frame` (A+B): fixed 94d2f77ca6
- `fit()` and the refit after a layout run fold container poses into already-world poses a second time (A+B): fixed 3354c9cb51
- Double-clicking an end label edits or creates the middle label (A): fixed 5c46fd703c. Also 02ca3f3b9d: `onEditLabel` now gets `(edge, end?)` and a custom `commit` gets the pressed `labelId`, with a new `labelEndOf` export. Changeset level `minor`, since this adds API.
- createEdgeEnds drops `frame` (A+B): fixed 3544a05d6e. This also covers reconnect, waypoints and route commands, which all call it.
- Connect with custom `routers` shows the custom route in the preview but commits an edge drawn with `EDGE_DERIVE_PATH` (B): fixed 41e2610eac. The new `edgeDerivePath` option carries the host's registered derive path. Development warns when `routers` or `frame` is set without `edgeDerivePath` or `commit`. The `frame` half was found in the sweep. Behavior call recorded in `docs/unruled.md`.
- DiagramView's connect preview uses a different router from the one the reported edge is drawn with (B): fixed 56d7679e90. If `portOptions.router` is set, the preview uses it and `onConnect`'s edge names it. If unset, the preview uses `'bezier'` (what `diagramScene` uses) and the edge names no router. Behavior call recorded in `docs/unruled.md`.
- relayoutBodies measures a face the build didn't use, so stencil-inserted rows move on a theme change (B): fixed d018c8e270. `stencilInsertOps` now measures in the face it stores, through a new internal `filledMeasure` helper in `rowMeasure.ts`.
- useDiagramTools gives tools to stencils (containers, and every non-flowchart group) that the `useStencilInsert` its doc pairs it with can't build (B): fixed c826960b4b. Development now warns once per unknown stencil id, and the doc names `containers: CONTAINER_STENCILS`. Behavior call recorded in `docs/unruled.md`.

Extra found while fixing (sweep, not fixed): `avoid/sceneInput.ts:61` builds its port options from `poseDescriptor` only, with no `frame`. It is outside this area, and its options type has no `frame` field, so it was left alone.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file, all pass:
  - DiagramView.edit.test.tsx: 10 passed
  - connect.scene.test.ts: 12 passed
  - connectorTool.test.ts: 4 passed
  - diagramFit.test.ts: 3 passed
  - edgeEndLayer.test.ts: 1 passed
  - edgeLabel.test.ts: 16 passed
  - stencil.test.ts: 17 passed
- Each new test failed before its fix, except the two warning tests (connect `routers`, `useStencilInsert`) and the `edgeDerivePath` test, which test new behavior and could not run before it existed.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed 4 of 32 (typecheck, typecheck:packages, audit:jsdoc, check:changesets); each fix was folded into its own commit before the rerun.
- `npm run lint -w @weasel-js/diagram`: fail, "Missing script: lint", because the package has no lint script. In its place, eslint on every changed package file: pass (exit 0).
- No browser tests touched. Tree clean.