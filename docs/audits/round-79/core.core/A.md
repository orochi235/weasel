# Audit round 79 — core.core findings

## useSceneStream disposes its memoized stream in a StrictMode effect replay, leaving a dead stream for the component's life
- where: packages/core/src/core/stream/useSceneStream.ts:14 (useSceneStream)
- scenario: under `<StrictMode>` (dev), React mounts, runs the effect cleanup (`stream.dispose()`), then re-runs effects while keeping the same `useMemo` value. `TileStream.dispose` sets `disposed = true` and `update` returns early from then on (packages/tiles/src/stream.ts:65), and the scene's edit pass is removed, so every `update` from `onViewChange` loads nothing: the streamed scene stays empty in development. Separately, `streamScene` has side effects (`scene.addEditPass`) inside `useMemo`; a render React discards (StrictMode double render, a concurrent render thrown away) creates a stream whose edit pass is never removed, a leaked pass that keeps running on every edit. The stream should be created and disposed inside one effect (or created lazily in a ref and recreated when found disposed).
- evidence: read
- severity: high

## usePointerStylus treats an element from another window (a popout) as a ref and listens to nothing
- where: packages/core/src/core/stylus/usePointerStylus.ts:65 (usePointerStylus)
- scenario: `usePointerStylus(popoutEl)` where `popoutEl` belongs to a popout window's document: `target instanceof HTMLElement` is false (the main realm's `HTMLElement`), so the code reads `target.current`, which is `undefined`, and binds no listeners; the hook reports `IDLE` forever. Should distinguish a ref by `'current' in target` rather than by realm-bound `instanceof`. (The same file's no-target default also always binds the main `window`, unlike `watchDevicePixelRatio`'s `view` parameter.)
- evidence: read
- severity: medium

## stableStringify writes NaN, Infinity, -Infinity and null as the same string, contradicting its "one string only when equal" contract
- where: packages/core/src/core/stableStringify.ts:8 (stableStringify)
- scenario: `stableStringify({ a: NaN }) === stableStringify({ a: null }) === stableStringify({ a: Infinity })` — all `{"a":null}`, because non-finite numbers pass through to `JSON.stringify`. Callers use it as an equality test (packages/forge/src/shell/Workshop.tsx:174, frameLink.ts:84) and cache key (instrumentCache.ts:67, labkit openLab.ts:56 fingerprint), so a lab global moved from `null` to `Infinity` (or a NaN control value) is judged unchanged and dropped, and two distinct entries share one cache key. Non-finite numbers need a tag like bigint's.
- evidence: read
- severity: medium

## AreaSelectAdapter's doc says useSelectTool's marquee needs four adapter methods; the marquee runs through the `areaSelect` dep built from the scene
- where: packages/core/src/core/adapters/types.ts:118 (AreaSelectAdapter doc)
- scenario: the doc says `useSelectTool` wires the marquee only when the adapter has `hitTestArea`, `getSelection`, `setSelection` and `applyOps`, and that `applyOps(ops)` is called with no label. `areaSelectAction` (packages/editing/src/actions/select/areaSelect.ts) reads `ctx.deps.areaSelect`, which `useAreaSelectDepSource` builds from the scene and `SelectionApi` (packages/editing/src/deps/areaSelect.ts), and writes with `dep.setSelection`, never `applyOps`. A consumer following the doc implements adapter methods the marquee never calls, or concludes the marquee is off when they are absent.
- evidence: read
- severity: low

## shapeKinds' header says the module imports nothing at runtime; it imports `getOwn` at runtime
- where: packages/core/src/core/shapeKinds.ts:1 (module doc)
- scenario: the header says "This module imports nothing at runtime on purpose", but line 9 is a value import of `getOwn` from `@weasel-js/registry`. A reader relying on the claim to reason about module-evaluation order (the reason the header gives) is misled; the comment should say it imports nothing through the package barrel.
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
packages/core/src/core/stream/streamScene.ts
packages/core/src/core/stream/useSceneStream.ts
packages/core/src/core/stylus/stylus.ts
packages/core/src/core/stylus/usePointerStylus.ts

<!-- done: 5 findings, files read: 28 -->
