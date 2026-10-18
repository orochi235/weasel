---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Annotation layers, and measurements kept on them. A layer declared with `annotation: true` (in `systemLayers` or `addLayer`) holds aids rather than content: its nodes draw on the canvas, save with the scene (`toJSON` keeps the flag), and undo with it, while content picking — clicks, marquee, lasso, Select All — passes through them. `isAnnotationLayer`, `isAnnotationNode`, and `annotationLayerIds` are the one question export, picking, and layer lists ask; export code should leave out what they say yes to.

A measurement is a leaf on an annotation layer whose `data.measure` holds its two ends in world units (`measureNode(id, layer, start, end)`), drawn by the built-in `kit:measure` painter as a line with a tick across each end. `measurementOf(node)` reads one as a `Measurement` — `start`, `end`, `dx`, `dy`, `distance`, and `angle`, in radians, read like a protractor: counterclockwise-positive on screen, so a line rising up and to the right at 30° reads +30°.

`createMeasurements({ layer })` names the layer and holds what is not the document's: which measurement is picked, and the one a measure drag is drawing. Give the same object to:

- `useMeasureTool({ measurements, angleStep? })` (key M, icon `core:measure`): a drag adds a measurement, both ends through the `snap` dep and Shift holding the angle to `angleStep` (default 15°), and picks it; a click picks the measurement under it; Escape drops the pick and Delete removes it.
- `measurementsContribution(scene, measurements)`, installed with `<SceneCanvas ambient>`: under every tool, a click on a measurement picks it without touching the content selection, a drag on the picked one's end moves that end, and a drag anywhere else on one carries it. Its commands, in the `measure` group: `measure.moveBy` moves the content selection by the current measurement's offset and `measure.rotateBy` turns it about its center the way the line goes, each one undo step Transform Again repeats; `measure.delete` and `measure.clear` remove one or all. The current measurement is the picked one, else the newest.
- `<MeasureReadout scene measurements>` in `@weasel-js/ui`: the current measurement's distance, offset, and angle, with Move by, Rotate by, Delete, and Clear all.

`@weasel-js/ui`: `useSceneLayerList` leaves annotation layers out unless given `annotations`, when each gets a row holding its nodes, marked not printed: the layer can be hidden from its row, and its nodes picked and removed. `LayerListItem` gains `nonPrinting`, `hideable`, and `removable`. `BarActionButton` takes a `disabledReason`, which keeps a disabled button focusable with its reason in the tooltip and in `aria-description`; `useActionStates` reports the reason an action gives.
