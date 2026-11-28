## A pool with no box nested in a boxed container gets no lane boxes, so its lanes vanish and its members have no seat
- where: packages/diagram/src/dataContainerPlace.ts:76 (placeContainers)
- scenario: `containers: [{ id: 'C', role: 'container', box: {...}, members: ['P'] }, { id: 'P', role: 'pool', lanes: [{ id: 'L', members: ['n'] }] }]`. P is hidden inside C, so layout never places it, and it has no `box`: `box === null` sends it down the "empty" branch (seated as `EMPTY_CONTAINER`, `continue`), skipping the pool branch that stacks its lanes. L never gets an entry in `out`. Node n (hidden, no `at`) is seated in L via `seatOf`, and `seedRows(..., bodyBox(out.get(L)!, ...))` gets `undefined` as the box: it throws or yields NaN rows. With `at` on n, `containerSpecs` still drops L (no box), leaving n's parent missing. The pool should be seeded at its default size (`DEFAULT_POOL_ACROSS` × lane sizes, as `startBox` gives a root pool) and its lanes stacked inside it.
- evidence: read
- severity: medium
- fix: packages/diagram/src/dataContainerPlace.ts, packages/diagram/src/dataContainers.ts
- size: function
- cause: nested unboxed pool treated as an empty container
- confidence: likely

## A body end lands on a shape whose every port `showsPort` hides, and routes to a hidden port
- where: packages/diagram/src/connectTargets.ts:181 (createResolver.landing)
- scenario: connect with `bodies: true` and `showsPort` turning away all of a node's ports. `portTarget` skips them, but `landing` accepts the body whenever `portsOf(...)` is non-empty (unfiltered), and `portFor` → `resolveEnd` picks one of the hidden ports. The edge glues to a port the option says cannot be landed on. The body check should count only ports `showsPort` keeps, and the resolution should pick only among those.
- evidence: read
- severity: low
- size: function
- cause: showsPort applied on the port path only
- confidence: likely

## A bounded view's limits come from the specs' poses, not where a live layout moved the nodes
- where: packages/diagram/src/DiagramView.tsx:118 (Inner, viewBounds)
- scenario: `bounded` together with `ref.layout('force')`. The live layout moves nodes in the scene, but `diagramViewBounds(specs, ...)` reads only the given specs, and it recomputes only when they change. A node the run moves outside the specs' union can't be panned to. After the run settles, `fitting.settle()` fits `current()`, but `fitDiagram` clamps that fit to the same stale `bounds`, so the settle fit can't frame the moved nodes either.
- evidence: read
- severity: low
- size: function
- cause: bounds derived from specs, not the scene
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

<!-- done: 3 findings, files read: 39 -->
