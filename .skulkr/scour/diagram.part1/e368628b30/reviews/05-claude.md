## A bounded DiagramView keeps its view inside the specs' bounds after a live layout has moved nodes outside them
- where: packages/diagram/src/DiagramView.tsx:126 (Inner, `viewBounds` memo)
- scenario: `<DiagramView bounded specs={…} ref={api}>`, then `api.layout('force')` spreads the nodes past where the specs placed them, and the host does not write `onMove` back. `viewBounds` is `diagramViewBounds(specs, …)`, built from the given specs, never from the scene. So the canvas clamps every view to the old rect, and `fitting.settle()` (which fits `current()`, the nodes where they now stand) also clamps its fit to that rect through `fit.bounds`. Nodes outside it can't be panned to or fitted. The view's bounds and its fit end up describing two different diagrams. Expected: the bounds follow the nodes as drawn, the same nodes `settle`/`fitNow` frame.
- evidence: read
- severity: medium
- fix: packages/diagram/src/DiagramView.tsx, packages/diagram/src/diagramFit.ts
- size: function
- cause: bounds read from specs, fit read from scene
- confidence: likely

## useDiagramFit's defaultView memo leaves out `fit.bounds`, so the opening fit stays clamped to stale bounds
- where: packages/diagram/src/diagramFit.ts:127 (useDiagramFit, `defaultView` memo deps)
- scenario: `fitDiagram` clamps the fit to `fit.bounds` so that the view the canvas holds is the fit itself, and a later fit still sees the view as untouched. The memo's deps list `minScale`, `maxScale`, `anchor` and `padding` but not `bounds`. When `bounded` turns on after mount, or the bounded specs change and `viewBounds` changes, `defaultView` keeps its old clamp, or none. The canvas then clamps the view against the new `viewBounds` itself, `canvas.getView()` stops matching `fitted.current`, and the target effect's `sameView` check reads every later refit as a user pan and drops it.
- evidence: read
- severity: low
- size: line
- cause: incomplete memo deps
- confidence: likely

## clusterBoxes places a cluster's box around its members' bare boxes, while CLUSTER_DERIVE_POSE grows each member by its `margin`
- where: packages/diagram/src/dataClusters.ts:105 (clusterBoxes)
- scenario: a clustered node with `portLabels` gets a `margin` on its trait (bodyTrait → marginOf). `clusterBoxes` takes the union of `placedAt.get(m)` with no margin. `clusterDerivePose` (clusterBox.ts:91) and `placeContainers`' fitted-container footprint (dataContainerPlace.ts:111) both apply `grownBy(…, margin)`. So the cluster spec's pose, which `scenePageSplits` and `fitDiagram`/`diagramViewBounds` read from specs, is smaller than the box the scene derives and draws. The port labels fall outside the box as the specs report it. Two answers to one box.
- evidence: read
- severity: low
- fix: packages/diagram/src/dataClusters.ts
- size: function
- cause: margin not applied to members
- confidence: likely

## A body end lands on a participant whose ports `showsPort` hides entirely
- where: packages/diagram/src/connectTargets.ts:183 (createResolver.landing)
- scenario: a connect is set up with `bodies: true` and a `showsPort` that turns away every port of node N. `portTarget` honors `showsPort`, but the body branch only checks `portsOf(...).length === 0` and never applies `showsPort`. The release lands on N's body, and the committed edge resolves (`resolveEnd`) to a port that `showsPort` says isn't shown. Expected: a body whose shown ports are none is "nothing", as the comment says of a body with no ports.
- evidence: read
- severity: low
- size: line
- cause: showsPort filter skipped on body path
- confidence: likely

## Files read
packages/diagram/src/DiagramView.tsx
packages/diagram/src/StencilGhost.tsx
packages/diagram/src/actionParamSchema.ts
packages/diagram/src/applyEdit.ts
packages/diagram/src/batchedEdits.ts
packages/diagram/src/body.ts
packages/diagram/src/bodyFollower.ts
packages/diagram/src/bodyNode.ts
packages/diagram/src/bodyRelayout.ts
packages/diagram/src/bodyRules.ts
packages/diagram/src/buildBody.ts
packages/diagram/src/chain.ts
packages/diagram/src/chainClusters.ts
packages/diagram/src/chainRoutes.ts
packages/diagram/src/cluster.ts
packages/diagram/src/clusterBox.ts
packages/diagram/src/clusterFixture.ts
packages/diagram/src/clusterReorder.ts
packages/diagram/src/clusterTree.ts
packages/diagram/src/clusterUpgrade.ts
packages/diagram/src/connect.ts
packages/diagram/src/connectTargets.ts
packages/diagram/src/connectorTool.ts
packages/diagram/src/contribution.ts
packages/diagram/src/dataClusters.ts
packages/diagram/src/dataColors.ts
packages/diagram/src/dataContainerPlace.ts
packages/diagram/src/dataContainers.ts
packages/diagram/src/dataEdges.ts
packages/diagram/src/dataPages.ts
packages/diagram/src/dataStyles.ts
packages/diagram/src/dataTypes.ts
packages/diagram/src/diagramEditing.ts
packages/diagram/src/diagramFit.ts
packages/diagram/src/diagramTools.ts
packages/diagram/src/diagramTypes/catalog.ts
packages/diagram/src/diagramTypes/doc.ts
packages/diagram/src/diagramTypes/edge.ts
packages/diagram/src/diagramTypes/index.ts

<!-- done: 4 findings, files read: 39 -->
