---
'@weasel-js/core': patch
---

A measure tool. `useMeasureTool()` (key M, `MeasureIcon`) measures a drag in world units: both ends go through the `snap` dep, and Shift holds the angle to 15° steps. The measurement stays on the canvas, drawn as a line with a tick across each end, until the next drag, Escape, or a switch to another tool.

The tool owns three commands in the `measure` group, so `<ActionBar group="measure">` draws them: `measure.moveBy` moves the selection by the measured offset, `measure.rotateBy` turns it about its center by the measured angle, and `measure.clear` drops the measurement. Each transform is one undo step, and Transform Again repeats it.

The measurement lives in a `MeasurementStore` (`createMeasurementStore()`); pass one as `useMeasureTool({ store })` to read it outside the canvas, and `useMeasurement(store)` re-renders on each change. A `Measurement` carries `start`, `end`, `dx`, `dy`, `distance`, and `angle`, in radians on the world's axes, so a positive angle turns clockwise on screen, the same way a rotate by it turns. `measureBetween(a, b)` computes one, and `createMeasureActions(store)` builds the actions for a tool of your own.
