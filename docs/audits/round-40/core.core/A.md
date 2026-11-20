I couldn't write `.skulk/out/findings.md` because permission was denied, so the whole findings document is below.

## legalSelection's read memo serves a stale selection when the scene's rules change but the api's array does not
- where: packages/core/src/core/selection/legalSelection.ts:36 (legalSelection, `read`)
- scenario: `read` recomputes `selectable(ids)` only when `api.get()` returns a different array. What `selectable` keeps depends on the scene (a node removed, hidden, locked), not only on `ids`. A caller-supplied api passed as `<SceneCanvas selection>` that does not take the settle write (one built with `lock: true`, whose `set` is a no-op, or a React-state api whose `get()` keeps returning the old array until it re-renders) keeps the same array after the scene locks or deletes a selected node. The view then keeps answering `get()`/`current`/`contains()` with the cached `kept`, which still holds the node the scene just made illegal. With `lock` it stays that way indefinitely, so chrome and actions act on a deleted or locked node. The memo should be keyed on the scene's change as well (or invalidated by `rules.subscribe`), not only on the array's identity.
- evidence: read
- severity: medium

## A layer listed twice in `layerOrder` is painted twice, both times carrying the same retain id
- where: packages/core/src/core/layers/render.ts:302 (paintedLayers), :225 (drawLayers → drawLayerOnce)
- scenario: `layerOrder = ['grid', 'scene', 'grid']`, which is easy to get by concatenating a default order with an override. `paintedLayers` maps each order entry through `byId`, so `grid` comes back twice and `drawLayers` draws it twice. A translucent layer then paints at double density. Once it is cached and large enough to be retained, both copies are emitted as groups with `retain: 'grid'`, so the renderer receives two kept surfaces under one key in a single frame. `isLayerPainted` uses `order.includes` and treats the order as a set, so painting and hit-testing disagree about what a duplicate means. Neither path dedupes the order or warns about it, though `warnUnknownOrderIds` does warn about unknown ids.
- evidence: read
- severity: low

## usePointerStylus binds to `window` for good when a ref's element is not attached at effect time
- where: packages/core/src/core/stylus/usePointerStylus.ts:56 (usePointerStylus effect)
- scenario: `usePointerStylus(ref)`, where the element behind `ref` renders conditionally (for example after a loading state) or is swapped for another. The effect runs once, since `target` is the stable ref object. If `ref.current` is null at that point, the hook falls back to `window` and listens to every pointer on the page. If the element is replaced later, the hook keeps listening to the old target. In both cases the snapshot reports pointers outside the intended element, and the hook never re-binds.
- evidence: read
- severity: low

## usePointerStylus's `hovering` never becomes true with the default `window` target
- where: packages/core/src/core/stylus/usePointerStylus.ts:96 (onEnter/onLeave)
- scenario: `usePointerStylus()` with no target listens for `pointerenter`/`pointerleave` on `window`. Those events do not bubble and are dispatched to elements, not to `Window`, so `hovering` stays `false` for the hook's default use, including a Pencil hovering near the glass. The `PointerStylusState.hovering` doc promises the hover flag without mentioning this.
- evidence: read (inference from Pointer Events dispatch rules; not run)
- severity: low

## stableStringify returns `undefined` despite its `string` return type, and its tags collide with real objects
- where: packages/core/src/core/stableStringify.ts:30 (stableStringify)
- scenario: `stableStringify(undefined)`, `stableStringify(() => {})`, or a value whose `toJSON` returns `undefined` all return `undefined` from `JSON.stringify`, typed as `string`. Callers then do different things: forge's `argsContext.ts` guards with `?? ' undefined'`, while `vite/capture/endpoint.ts` passes the result straight to `hash.update`, which throws on `undefined`. Separately, `10n` and the plain object `{ $type: 'bigint', value: '10' }` encode to the same string, and so do a cycle and `{ $type: 'cycle' }`. That breaks "two equal values produce one string" in the direction equality checks like forge `route/url.ts:188` depend on: unequal values compare as equal.
- evidence: read
- severity: low

## warnLayersOnce's dedupe set grows without bound
- where: packages/core/src/core/layers/unknownOrderIds.ts:3 (warned)
- scenario: The module-level `warned` Set keeps every distinct warning message for the life of the page, and each message embeds layer and group ids. A dev session whose layer stack is generated from data, such as `scene:<layerId>` for user-created layers, or that churns `layerOrder` and groups, adds one entry per distinct id and never prunes them. This is dev-only, but nothing bounds it.
- evidence: read
- severity: low

## Files read
packages/core/src/core/adapters/testing/rootsTree.ts
packages/core/src/core/adapters/types.ts
packages/core/src/core/applyOps.ts
packages/core/src/core/device/index.ts
packages/core/src/core/device/targets.ts
packages/core/src/core/device/types.ts
packages/core/src/core/device/useDeviceProfile.ts
packages/core/src/core/device/useTargetBasePx.ts
packages/core/src/core/device/watchDevicePixelRatio.ts
packages/core/src/core/isPlainObject.ts
packages/core/src/core/layers/backgroundFill.ts
packages/core/src/core/layers/children.ts
packages/core/src/core/layers/dims.ts
packages/core/src/core/layers/gateLayer.ts
packages/core/src/core/layers/layerGroup.ts
packages/core/src/core/layers/redrawSource.ts
packages/core/src/core/layers/render.ts
packages/core/src/core/layers/retain.ts
packages/core/src/core/layers/unknownOrderIds.ts
packages/core/src/core/modifierState.ts
packages/core/src/core/pbt.fixture.ts
packages/core/src/core/persistence/codec.ts
packages/core/src/core/persistence/pbt.fixture.ts
packages/core/src/core/persistence/sceneDocument.ts
packages/core/src/core/selection/chromeState.ts
packages/core/src/core/selection/legalSelection.ts
packages/core/src/core/selection/readOnlySelection.ts
packages/core/src/core/selection/selectionContract.ts
packages/core/src/core/selection/selectionTarget.ts
packages/core/src/core/selection/usePublishSceneSelection.ts
packages/core/src/core/selection/viewerSelection.ts
packages/core/src/core/shapeKinds.ts
packages/core/src/core/stableStringify.ts
packages/core/src/core/stylus/stylus.ts
packages/core/src/core/stylus/usePointerStylus.ts

<!-- done: 6 findings, files read: 35 -->