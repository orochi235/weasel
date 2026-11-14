---
'@weasel-js/path-tools': major
'@weasel-js/routing': major
---

The Corner shape tool is now Fillet, and every name it carried changes with it; this is breaking, with no aliases.

| Before | After |
|---|---|
| `cornerShapePreset`, `createCornerShapePreset`, preset id `'cornerShape'` | `filletPreset`, `createFilletPreset`, `'fillet'` |
| action `editCorner`, its binding `editCorner.drag`, `editCornerAction`, `EDIT_CORNER_PARAMS`, `EditCornerParams` | `editFillet`, `editFillet.drag`, `editFilletAction`, `EDIT_FILLET_PARAMS`, `EditFilletParams` |
| action `setCorners`, `setCornersAction` | `setFillets`, `setFilletsAction` |
| action `cycleCornerShape`, `cycleCornerShapeAction`, `CYCLE_CORNER_SHAPE_PARAMS`, `CycleCornerShapeParams` | `cycleFillet`, `cycleFilletAction`, `CYCLE_FILLET_PARAMS`, `CycleFilletParams` |
| `CORNER_SHAPE_OPTIONS`, `DEFAULT_CORNER_SHAPE`, `DEFAULT_CORNER_TRIM_SHARE` | `FILLET_SHAPE_OPTIONS`, `DEFAULT_FILLET_SHAPE`, `DEFAULT_FILLET_TRIM_SHARE` |
| `CORNER_CONTROLS`, `CORNER_CONTROLS_PROMPT`, `CORNER_K_SLIDER_RANGE`, `cornerControlsParams`, `cornerControlsState`, `CornerControlsState` | `FILLET_CONTROLS`, `FILLET_CONTROLS_PROMPT`, `FILLET_K_SLIDER_RANGE`, `filletControlsParams`, `filletControlsState`, `FilletControlsState` |
| `useCornerControls`, `CornerControlsScene`, `CornerControlsSelection`, `UseCornerControlsReturn` | `useFilletControls`, `FilletControlsScene`, `FilletControlsSelection`, `UseFilletControlsReturn` |
| `createCornerWidgetsExtension`, `cornerWidgetCommands`, `cornerWidgetFrames`, `CORNER_WIDGET_STANDOFF_PX`, `CornerWidgetStyle` | `createFilletWidgetsExtension`, `filletWidgetCommands`, `filletWidgetFrames`, `FILLET_WIDGET_STANDOFF_PX`, `FilletWidgetStyle` |
| chrome id `path-edit.corners`, `PATH_CORNERS_CHROME_ID` | `path-edit.fillets`, `PATH_FILLETS_CHROME_ID` |
| toggle `pathEdit.show.corners`, `showCornersAction` | `pathEdit.show.fillets`, `showFilletsAction` |
| widget hit kind `corner:N`, routing's `isCornerWidget` | `fillet:N`, `isFilletWidget` |
| icon `path-tools:cornerShape` | `path-tools:fillet` |

Core's CSS `corner-shape` model keeps its names: `CornerSpec`, a polygon's `corners`, `resolveCorners`, `CornerShape`, and the keywords, so saved documents load as before.

```ts
// before
<SceneCanvas features={['paths', cornerShapePreset]} tune={{ cycleCornerShape: { bindings: [{ kind: 'key', key: 'k' }] } }} />
// after
<SceneCanvas features={['paths', filletPreset]} tune={{ cycleFillet: { bindings: [{ kind: 'key', key: 'k' }] } }} />
```

<!-- entry: rank=5 breaking api -->
