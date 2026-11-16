---
'@weasel-js/core': minor
---

`<SceneCanvas>` sources an `inspection` dep, `CanvasInspection`, for a plug-in that inspects the canvas rather than acting on it.

It reads the canvas's tools, preset contributions, node kinds, actions and dep registries, its `<DevtoolsLabel>`, the debug flags in effect and a setter laying flags over them, its test probes, and its `clientToWorld` conversions as `CoordTraceEntry` records, kept only once asked for. `subscribe` reports a change to the scene, selection, active tool or registry. A contribution's `attach` reads it with `deps.get('inspection')`; `@weasel-js/devtools` is built on it.

<!-- entry: api -->
