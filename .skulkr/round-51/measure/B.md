# Audit round 51 — area `measure`

## MeasureReadout shows the committed measurement, not the one shown, while a measurement drag runs
- where: packages/measure/src/MeasureReadout/MeasureReadout.tsx:62-69 (MeasureReadout)
- scenario: under any tool, drag the picked measurement's end (or the whole line) with `measure.drag`. The drag publishes its preview as pose/data overrides (`previewData`/`previewPose` in measureActions.ts:181-182). The painter, the layer's handles (`shownLookup` in measureLayer.ts:45) and `measureHitAt` (`shownLookup`, measureHit.ts:26) all follow the pointer. The readout reads `measurementOf(scene.get(id))` and subscribes only to `scene.subscribe`/`ms.picked`/`ms.draft`, so its Distance/ΔX/ΔY/Angle stay at the pre-drag values until release. A create drag, by contrast, updates the readout live through `ms.draft`. The readout should read the measurement as shown (overrides applied) and re-render when the overrides change.
- evidence: read
- severity: medium

## The "current" measurement can be a hidden one, which hit-testing and the handles pass over
- where: packages/measure/src/measurements.ts:50-57 (currentMeasureId), used by measureCommands.ts:13-19 (current) and MeasureReadout.tsx:68
- scenario: the newest measurement node is hidden (`node.hidden`, or a hidden ancestor) and nothing is picked, or the picked one is hidden after picking. `measureHitAt` skips it (`gates.hidden`, measureHit.ts:27) and the layer draws no handles for it (`scene.isHidden`, measureLayer.ts:46). Yet `currentMeasureId` returns it: the readout shows numbers for a measurement that is not on screen, and Delete/Backspace under the measure tool, Move by and Rotate by act on the invisible one. The same question (which measurement is in play) is answered with the gates in one place and without them in another. The current measurement should skip hidden nodes as the hit test does.
- evidence: read
- severity: low

## Files read
packages/measure/src/MeasureReadout/MeasureReadout.module.css
packages/measure/src/MeasureReadout/MeasureReadout.stories.module.css
packages/measure/src/MeasureReadout/MeasureReadout.stories.tsx
packages/measure/src/MeasureReadout/MeasureReadout.tsx
packages/measure/src/MeasureReadout/index.ts
packages/measure/src/actionIds.ts
packages/measure/src/actionParamSchema.ts
packages/measure/src/icons.gen.ts
packages/measure/src/index.ts
packages/measure/src/measureActions.ts
packages/measure/src/measureCommands.ts
packages/measure/src/measureContribution.ts
packages/measure/src/measureEdits.ts
packages/measure/src/measureHit.ts
packages/measure/src/measureLayer.ts
packages/measure/src/measurePainter.ts
packages/measure/src/measurement.ts
packages/measure/src/measurements.ts
packages/measure/src/testing/snapDep.ts
packages/measure/src/toolSets.ts
packages/measure/src/useMeasureTool.ts

<!-- done: 2 findings, files read: 21 -->
