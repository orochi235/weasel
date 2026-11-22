# Audit round 72 — core.barrel

No defects found. I checked:

- Names exported by more than one barrel (`TargetTransform`, `PRESET_CHROME`, `nodesAsShown`, `shownLookup`). Each resolves to the same symbol (`affordances/hitAffordanceRegions.ts:112` re-exports targetFrame's `TargetTransform`; `presets/index.ts:4` re-exports `./chrome`; `core/scene/index.ts:76` re-exports `./nodeAsShown`), so there is no ambiguous `export *`.
- `export *` of an external package, which typechecks but emits no binding in the bundle. There are none anywhere in `packages/core/src`. Every star in the barrels points at a local module.
- `@internal` symbols and `_…ForTests` seams reaching the barrel. The local star targets I checked (`debug`, `domains/viewports`, `layout`, `tools`, `animation`) export none of them.
- The bare `core/…` specifiers in `scene.ts`. They match the `core/*` path alias in `packages/core/tsconfig.json`, which the rest of core's source also uses.

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

<!-- done: 0 findings, files read: 15 -->
