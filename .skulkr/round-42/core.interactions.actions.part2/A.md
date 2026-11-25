## `useNotices` throws outside a `<DepRegistryProvider>`, though its doc says it silently does nothing there
- where: packages/core/src/interactions/actions/useNotices.ts:8 (useNotices)
- scenario: a host component calls `useNotices(toaster)` in a tree with no `<DepRegistryProvider>` (e.g. rendered before or outside `<SceneCanvas>`, as the doc invites). `useDepSource` calls `useDepRegistry()` (packages/routing/src/interactions/actions/depRegistry.tsx:24), which throws "useDepRegistry: no DepRegistryProvider in scope", crashing the render. The doc promises a no-op; the code would need `useOptionalDepRegistry` (as `useStandardDeps`/`useActionSet` in this directory use) to deliver it.
- evidence: read
- severity: medium

## `resolvePreviews` returns a previewed node twice when a non-previewed container sits between it and a previewed frame
- where: packages/core/src/interactions/actions/resolvePreviews.ts:124 (resolvePreviews, root loop) with :104-110 (build)
- scenario: a frame-composing scene with group G (defines a frame) → container C → leaf X. A gesture previews G (a move of G) and a source also previews X (e.g. a transform follower, or a second handle), but not C. `build(G)` carries every descendant (`carries` / `riding`), so X is built inside G → C → X. The root loop then skips X only if X's *direct* parent is in `ids`; C is not, so X is also built as a root of its own. The forest (and `flattenPreviews`) lists X twice and its ghost is painted twice (double alpha, and the source hidden twice). The root test should ask whether any ancestor is previewed and carried, not just the parent.
- evidence: read
- severity: medium

## `insertExtrasFromPlane` rewrites a consumer insert kind's extras, though it says those pass through opaque
- where: packages/core/src/interactions/actions/planeInput.ts:314 (insertExtrasFromPlane)
- scenario: a consumer-defined insert kind on a parallax layer publishes `extras: { kind: 'myKind', radius: 4, center: … }` where `radius` means something other than a plane-world length (a corner radius in screen px, a count). The function never checks `extras.kind` against the kit's kinds, so every `a`/`b`/`center`/`radius`/`outerRadius`/`samples` field is mapped out of the plane; the consumer's overlay renderer receives `radius` divided by the plane scale. The doc says "A consumer kind's extras are opaque, and pass through."
- evidence: read
- severity: low

## `resolveSpatialReference` accepts NaN and Infinity as a reference point
- where: packages/core/src/interactions/actions/spatialReference.ts:47 (resolveSpatialReference)
- scenario: an align or flip invoked with `to`/`pivot` `{ x: NaN, y: 0 }` (a param panel field cleared, or a computed reference divided by zero). `typeof NaN === 'number'`, so the function returns NaN bounds instead of `null` ("a malformed value" per its doc), and `flip`/`align` go on to build ops writing NaN poses rather than declining. A non-finite `width`/`height` likewise passes through.
- evidence: read
- severity: low

## Files read
packages/core/src/interactions/actions/moveOptions.ts
packages/core/src/interactions/actions/notices.ts
packages/core/src/interactions/actions/operands.ts
packages/core/src/interactions/actions/pathCommands/pathNodes.ts
packages/core/src/interactions/actions/pathGestureTags.ts
packages/core/src/interactions/actions/pbt.fixture.ts
packages/core/src/interactions/actions/pbtScene.fixture.ts
packages/core/src/interactions/actions/planeInput.ts
packages/core/src/interactions/actions/pointerState.ts
packages/core/src/interactions/actions/poseDescriptorDep.ts
packages/core/src/interactions/actions/poseFrame.ts
packages/core/src/interactions/actions/regionSelectDeps.ts
packages/core/src/interactions/actions/resizeOptions.ts
packages/core/src/interactions/actions/resolveOverlays.ts
packages/core/src/interactions/actions/resolvePreviews.ts
packages/core/src/interactions/actions/rotateOptions.ts
packages/core/src/interactions/actions/runLifecycle.ts
packages/core/src/interactions/actions/selectionSubtree.ts
packages/core/src/interactions/actions/settleWithinRounding.ts
packages/core/src/interactions/actions/snapDep.ts
packages/core/src/interactions/actions/spatialReference.ts
packages/core/src/interactions/actions/testUtils.ts
packages/core/src/interactions/actions/transform-again/memory.ts
packages/core/src/interactions/actions/transformFinish.ts
packages/core/src/interactions/actions/useActionSet.ts
packages/core/src/interactions/actions/useNotices.ts

<!-- done: 4 findings, files read: 26 -->
