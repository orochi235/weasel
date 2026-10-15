---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

A measure tool. `useMeasureTool()` (key M, `MeasureIcon`) measures a drag in world units: both ends go through the `snap` dep, and Shift holds the angle to steps of the `angleStep` option (radians, default 15°), read on every move. The measurement stays on the canvas, drawn as a line with a tick across each end, until the next drag, Escape, or a switch to another tool.

The tool owns three commands in the `measure` group, so `<ActionBar group="measure">` draws them: `measure.moveBy` moves the selection by the measured offset, `measure.rotateBy` turns it about its center by the measured angle, and `measure.clear` drops the measurement. Each transform is one undo step, and Transform Again repeats it.

The measurement lives in a `MeasurementStore` (`createMeasurementStore()`); pass one as `useMeasureTool({ store })` to read it outside the canvas, and `useMeasurement(store)` re-renders on each change. A `Measurement` carries `start`, `end`, `dx`, `dy`, `distance`, and `angle`. `dx` and `dy` are on the world's axes, y down; `angle` is in radians and reads like a protractor, counterclockwise-positive on screen, so a line rising up and to the right at 30° reads +30°. Rotate by turns the selection the way the line goes, which in the canvas's clockwise-positive rotation is `-angle`. `measureBetween(a, b)` computes one, and `createMeasureActions(store)` builds the actions for a tool of your own.

`@weasel-js/ui` adds `<MeasureReadout store={store}>`, the readout for it: a chip at the bottom of the nearest positioned ancestor with the distance, offset, and angle, and the `measure` group's buttons.

The ruler has one drawing: the icon pipeline emits it into core's `ACTION_GLYPHS` beside undo, redo, and delete, core's `MeasureIcon` draws it, `@weasel-js/ui` re-exports that same `MeasureIcon`, and `<Icon name="measure">` points at the same markup.
