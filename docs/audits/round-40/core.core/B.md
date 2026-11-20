# Audit round 40 — core.core findings

## A layer group's `effects` thunk that throws escapes `drawLayers` and loses the whole frame
- where: packages/core/src/core/layers/layerGroup.ts:108 (wrapGroup), called from packages/core/src/core/layers/render.ts:218 (drawLayers / closeRun)
- scenario: a consumer passes `groups={[{ id: 'g', layers: ['a','b'], effects: (view, dims) => computeBlur(view) }]}` and the thunk throws (e.g. reads state not yet set). `drawLayerOnce` catches a member's `draw`/`deps` throw and reports it via `onLayerError`, but `closeRun` calls `wrapGroup` outside any try, so the throw propagates out of `drawLayers` and nothing paints this frame (every other layer included) — exactly what `LayerDrawFailure`'s doc says the loop protects against. Expected: the group's failure reported through `onLayerError` (under the group id) and the run drawn without its effects, or dropped, with the rest of the frame intact.
- evidence: read
- severity: medium

## `legalSelection`'s read memo serves a stale selection after the rules change under an unchanged array
- where: packages/core/src/core/selection/legalSelection.ts:34 (legalSelection / read)
- scenario: `read` recomputes `selectable(ids)` only when `api.get()` returns a different array. `selectable` (the scene's `selection.legal`) depends on scene state — locks, visibility, removals — that changes without the selection array changing. `useLegalSelection` normally papers over this by calling `api.set` on every rules change, but when the supplied api ignores that write (a caller api built with `selectionOptions.lock: true`, or any read-only api passed as `selection`), the array identity never changes: lock a selected node and `view.get()` / `view.current` / `adapterMethods.getSelection()` keep returning it, contradicting the doc ("reads ... only what `selectable` keeps ... no locked, hidden or missing node"). Expected: the memo also keyed on a scene change counter, or recomputed per read.
- evidence: read (inferred from `sceneSelection.ts` `legal` reading reachability, and `lock` making `set` a no-op per `selectionContract.ts:30`)
- severity: low

## `usePointerStylus` never reports `hovering` with its default `window` target
- where: packages/core/src/core/stylus/usePointerStylus.ts:58 and :98 (usePointerStylus effect)
- scenario: `usePointerStylus()` with no target listens for `pointerenter`/`pointerleave` on `window`. Those events do not bubble and are dispatched only to elements, so a listener on `window` never fires, and `hovering` stays `false` forever with the default target — the doc's "true while the pen is near the glass" never holds. Expected: listen on `document.documentElement` (or use `pointerover`/`pointerout` with relatedTarget checks) when no element is given.
- evidence: read (event-dispatch behavior inferred from the Pointer Events spec, not run)
- severity: low

## `usePointerStylus` resolves a ref target once, so a ref filled or swapped later leaves it on `window` or the old element
- where: packages/core/src/core/stylus/usePointerStylus.ts:57-106 (usePointerStylus effect, deps `[target, optsRef]`)
- scenario: pass `ref` whose element mounts after the hook's first effect (conditional render, portal) — `target.current` is null then, so listeners go on `window`; or the ref moves to a different element — listeners stay on the first. The effect's deps hold the stable ref object, so it never re-runs. Expected: re-resolve when `ref.current` changes (callback ref / state-held element), or document that a ref must be set at first commit.
- evidence: read
- severity: low

## `usePublishSceneSelection` keeps stale kind labels when a selected node changes kind in place
- where: packages/core/src/core/selection/usePublishSceneSelection.ts:28 (usePublishSceneSelection)
- scenario: labels memo on `[scene, ids, describe]`; `scene` is a mutable object with a stable identity and `ids` keeps its identity across edits that do not change the selection. An edit that changes what `describe` reads of a selected node (its `kind`/`data`, same id) leaves the published label for that id at the old value until the selection itself changes. Expected: recompute labels on scene changes (the caller already subscribes via `useSyncExternalStore` in `useCanvasSelection.ts:43`, so recomputing per render, or keying on the nodes, would do).
- evidence: read (whether an in-place kind change occurs in practice is inferred, not run)
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

<!-- done: 5 findings, files read: 35 -->
