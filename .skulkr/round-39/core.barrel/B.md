# Audit round 39 — core.barrel

## The main entry still hands out the full content-handler list the canvas barrel says it deliberately withholds
- where: packages/core/src/barrel/canvas.ts:149 (ingestion section comment) and packages/core/src/barrel/editingSeams.ts:24 (`handlersFor`, `runIngest`, `couldClaim`)
- scenario: canvas.ts says "`getContentHandlers` is deliberately NOT exported — consumers reach the pipeline via `<SceneCanvas ingestion>` and `SceneCanvasApi.ingest`". But `index.ts:40` star-exports `barrel/editingSeams`, which puts `handlersFor` and `runIngest` on the same `@weasel-js/core` entry. `handlersFor(undefined)` returns `byPriority(registered())`, which is exactly what `getContentHandlers()` returns (contentHandlers.ts:160–168). `runIngest` lets a consumer run the pipeline without going through either route the comment names. So a consumer can do exactly what the comment says they can't, and the decision gets two different answers on one entry.
- evidence: read
- severity: low

## `SceneMembershipError` is thrown by public scene calls but is exported from no entry, though its sibling scene errors are
- where: packages/core/src/barrel/scene.ts:111 (scene error exports: `SceneArrivalRefused`, `SnapshotKeyError`, `SnapshotShapeError`, `RestoredOpError`)
- scenario: `scene.add` with an id the scene already holds throws `new SceneMembershipError('Scene: id collision …')` (core/scene/treeEdits.ts:89). A lookup of an unknown id throws the same class (core/scene/nodeStore.ts:44). The class is declared in core/scene/staleReplay.ts:15, but neither `core/scene/index.ts` nor any barrel re-exports it. A consumer catching scene errors can `instanceof` every other scene error class but not this one, so it has to match on the message string. It should be exported beside the other scene errors.
- evidence: read (grep shows no re-export anywhere in packages/)
- severity: low

## The viewport barrel's comment says `<MinimapCanvas>` is exported here, but it lives in `@weasel-js/minimap`
- where: packages/core/src/barrel/viewport.ts:118 (comment above the `SceneViewCanvas` export)
- scenario: The section is headed "Detached scene-view + minimap" and says "`<MinimapCanvas>` is the opinionated minimap built on top". A reader expects `import { MinimapCanvas } from '@weasel-js/core'` to work. It fails: the only `MinimapCanvas` is in packages/minimap/src/MinimapCanvas.tsx, and core does not export it.
- evidence: read
- severity: low

## Files read
packages/core/src/barrel/canvas.ts
packages/core/src/barrel/chrome.ts
packages/core/src/barrel/editingSeams.ts
packages/core/src/barrel/icons.ts
packages/core/src/barrel/input.ts
packages/core/src/barrel/interactions.ts
packages/core/src/barrel/outlines.ts
packages/core/src/barrel/paint.ts
packages/core/src/barrel/paths.ts
packages/core/src/barrel/persistence.ts
packages/core/src/barrel/renderer.ts
packages/core/src/barrel/routing.ts
packages/core/src/barrel/scene.ts
packages/core/src/barrel/snap.ts
packages/core/src/barrel/viewport.ts

<!-- done: 3 findings, files read: 15 -->
