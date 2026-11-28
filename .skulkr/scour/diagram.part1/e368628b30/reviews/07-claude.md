# Findings: diagram.part1

## `bounded` keeps the view inside the specs' bounds, not where the nodes are drawn
- where: packages/diagram/src/DiagramView.tsx:121 (Inner, `viewBounds`)
- scenario: `<DiagramView bounded onMove={…}>` on specs with unpinned nodes; call `api.layout('force')` (or drag a node outside the original extent while the host is slow to write, or ignore an `onMove`). The live layout moves scene nodes, but `viewBounds` is `diagramViewBounds(specs, …)` over the *given* specs' poses, so the canvas clamps every pan/zoom to the old extent and the moved nodes cannot be scrolled to. `fitting.settle()`/`fitNow()` fit `current()` (live poses) but then `clampView` with the same stale `fit.bounds`, so the settle fit itself is clamped off the diagram. The prop's doc says "Keep the view on the diagram".
- evidence: read
- severity: medium
- fix: packages/diagram/src/DiagramView.tsx, packages/diagram/src/diagramFit.ts
- size: function
- cause: view bounds derived from input specs rather than scene poses
- confidence: likely

## `startFrom: 'body'` starts a connect from a body that has no ports, which `landing` refuses as a target
- where: packages/diagram/src/connect.ts:279 (createConnectAction › startEnd)
- scenario: connector tool (`startFrom: 'body'`, `bodies: true`) pressed on a participant whose `portsOf` is empty (e.g. `ports: []`). `startEnd` takes `bodyAt(...)` with no port check, so the drag starts; the preview's `portFor(fixed, …)` resolves no port and draws nothing, yet a release on a valid target commits an edge glued to a body with nothing to route to. `connectTargets.landing` rejects exactly this case for the other end ("A body with no ports is nothing, since an edge glued to it has nothing to route to"), so the two ends answer the same question differently.
- evidence: read
- severity: low
- fix: packages/diagram/src/connect.ts, packages/diagram/src/connectTargets.ts
- size: line
- cause: port-less body check only on the landing side
- confidence: likely

## `buildBody` emits child row poses in the body's world frame while setting `parent`
- where: packages/diagram/src/buildBody.ts:80 (buildBody › leaf)
- scenario: a consumer calls the exported `buildBody(spec, { x: 200, y: 100, … }, { id: 'n', … })` and adds the specs to a scene with the default rigid composition. Each leaf has `parent: 'n'` and a pose from `layoutBody(spec, pose)`, i.e. offset by 200,100 already; the scene composes it with the parent's pose again and the rows draw at 400,200. Both in-repo callers (`fromData` via `localizeWorldPoses`, `stencil.ts` "Built in one frame; each row is stored in the body's") convert afterwards, and `bodyFollower`/`relayoutBodies` write rows in the body's own frame — the public function's docs never say its poses need localizing.
- evidence: read
- severity: low
- fix: packages/diagram/src/buildBody.ts (doc or emit local poses), packages/diagram/src/fromData.ts, packages/diagram/src/stencil.ts
- size: function
- cause: undocumented world-frame output beside a parent link
- confidence: likely

## A relayout measures a `field` row differently from the build, dropping its `room`
- where: packages/diagram/src/bodyRelayout.ts:119 (relayoutBodies)
- scenario: a body built with `{ kind: 'field', label: 'Name', value: 'x', room: 'XXXXXXXXXXXX' }`: `measureRow` floors its width at label + 2·gap + max(value, room). After any text edit `relayoutBodies` rebuilds every non-header row as `{ kind: 'label', text: 'Name: x' }`, measuring the concatenated string instead — no `room`, ": " in place of the 8-unit gap. The floor a field puts under the body is thus answered two ways (build vs. relayout); a value typed in past the old box grows the body by the label-row width, not the field width the build used, and `room`'s promise ("a value written in later fits the box it already has") is not what relayout checks against.
- evidence: read
- severity: low
- fix: packages/diagram/src/bodyRelayout.ts, packages/diagram/src/body.ts
- size: function
- cause: field rows not recorded as fields in `BodyLayout`
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
