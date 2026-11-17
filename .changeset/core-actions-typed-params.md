---
'@weasel-js/core': major
---

Bindings, triggers and tunings of core's actions that read params are checked against their `ActionParamSchema` entries.

New entries cover `place`, `insert.rotate`, `setFillOpacity`, `setStrokeOpacity`, `viewport.zoom`, `viewport.wheelPan`, `container.scroll`, `select.pick`, `select.deep`, `select.collapseDeferred`, `group.enter`, `group.leave`, `selectAnchor`, `cutPathAtAnchor`, `insertPathAnchor`, `enterPathEdit`, `enterTextEditAt`, `editEffectText`, `clipboard.paste`, `clipboard.pasteEvent`, `eyedropper.pick`, `pen.placeAnchor`, `slice.addPoint`, `measure.pick` and `measure.pickAt`; `polygon.adjustSides` and `star.adjustPoints` also take the wheel's `deltaY`. `DistributeParams.mode` and `ReorderParams.distance` are optional, since each action defaults them. New exported types: `PlaceParams`, `CountStepParams`, `OpacityParams`, `ViewportZoomParams`, `WheelScrollParams`, `PickParams` and `ModeTriggerParams`.

This is breaking for code that leans on the old types. A binding or trigger passing params one of these ids does not declare is now an error. The descriptors are typed `Action` (or `Action & { id }`), so `requires` is optional on them where it was `string[]`: `setFillAction`, `viewportZoomAction`, `reorderForwardAction` and the rest. `createViewportZoomAction`, `createViewportWheelPanAction`, `createLivePathEditAction` and `createToolActivateAction` return `Action`. `LivePathEditSpec` takes the command's params as `P`, `param` is a key of it, and `edit` reads them typed.

```ts
const tidy = createLivePathEditAction<{ tolerance?: number }>({
  id: 'tidyPath', label: 'Tidy', param: 'tolerance', params: TIDY_PARAMS,
  edit: ({ path }, tolerance) => tidyPath(path, tolerance),
  commit: (_deps, next) => [...next.values()].flatMap(({ node, path }) => reshapeOps(node, path, 'Tidy')),
});
```

<!-- entry: breaking api -->
