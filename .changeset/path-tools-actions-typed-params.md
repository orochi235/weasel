---
'@weasel-js/path-tools': major
---

Bindings and triggers of path-tools' actions check their params against `ActionParamSchema`, including the click, hover, and drag actions.

New schema entries: `snipPath`, `snip.preview`, `linkAnchor`, `editFillet`, `cycleFillet`, `textAlong`, `girth.clear`, `girth.hover`, `shapeBuilder.showFace`, `shapeBuilder.takeFace`, and `equalizeHandles`; `girth.drag`, `pin.addPin`, `spiro.placePoint`, `convertSegmentAt`, `configureWarp`, and `editPathEffect` now name every param they read, the event's `press`, `world`, or `mods` included. Two types are new exports: `StrokePressParams`, what a click command reads to find its stroke, and `ConfigureWarpParams`.

This is breaking in two places. `planSnip` takes `StrokePressParams` rather than `unknown`. `WarpSettings`, `GirthDragParams`, `KneadParams`, `TugPathParams`, `LinkAnchorParams`, `EditFilletParams`, and `CycleFilletParams` are type aliases now, so declaration merging no longer extends them.

```ts
planSnip(deps, { press, radiusPx: 4 });        // checked
planSnip(deps, event as unknown);              // now an error
```

<!-- entry: api breaking -->
