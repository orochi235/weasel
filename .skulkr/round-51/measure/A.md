# Audit round 51, area `measure`

Note: the brief names frozen commit d6aa8f2ede77fc3556ffbf594c570943b8bf31f2, which does not exist in this
clone (`git cat-file` reports a bad object). The tree read is HEAD 674caba3dd; `packages/measure` has no
uncommitted changes in it.

## Move by and Rotate by report enabled for a selection they cannot change, and then do nothing
- where: packages/measure/src/measureCommands.ts:22 (transformable), used by moveBy (:41) and rotateBy (:59)
- scenario: select only locked nodes (or nodes on a locked layer), draw a measurement, open the readout. `enabled`
  answers `requiresOperands(deps)` → `true`, so Move by / Rotate by show as available; pressing one runs
  `transformSelection`, whose `writesLocked` check refuses the ops and returns false, and nothing happens with no
  reason shown. The same holds when the ops come out empty (a selection of page structure only). The ruled answer
  for a command that would commit ops (2026-11-09 / 2026-11-10, `opsAnswer` in
  packages/editing/src/actions/lockedWrites.ts) is NotApplicable for no ops and Locked for a locked write, and the
  same file's `remove`/`clearAll` do gate on locks — so the decision is answered two ways in one file.
- evidence: read
- severity: medium

## The current measurement can be a hidden one, so Delete removes a measurement the user cannot see
- where: packages/measure/src/measurements.ts:50 (currentMeasureId), consumed by measureCommands.ts:13 (current) and MeasureReadout.tsx:68
- scenario: hide the measurement (or the annotation layer holding the measurements), then under the measure tool
  press Delete, or press the readout's Delete. `currentMeasureId` returns the picked id or the newest id on the
  layer with no hidden check, so `remove` is enabled, takes Delete away from the ambient delete, and deletes an
  invisible measurement; the readout keeps showing its numbers. Every other reader of measurements
  (`measureHitAt`, `measureEndSource`, the layer's handles) passes hidden ones over via `nodeGates`/`isHidden`.
- evidence: read
- severity: low

## A pick left pointing at a removed measurement keeps Deselect Measurement enabled and swallows Escape
- where: packages/measure/src/measureCommands.ts:131 (unpick.enabled)
- scenario: draw a measurement (it becomes picked), then undo it, or remove it from a layers panel. `ms.picked`
  still holds its id — nothing clears it — so `unpick.enabled` answers true; under the measure tool Escape runs
  `measure.unpick`, which changes nothing visible, instead of declining to the ambient `escape` as its comment
  intends. `currentMeasureId` already treats such a pick as absent (it checks the node is still a measurement);
  `unpick` should ask the same question.
- evidence: read
- severity: low

## A measurement off its layer still paints and snaps but can no longer be picked, edited, deleted or cleared
- where: packages/measure/src/measurePainter.ts:37 (MEASURE_PAINTER.matches) and packages/measure/src/measureHit.ts:59 (measureEndSource)
- scenario: move a measurement node to another layer (a layers panel's move-to-layer, or a loaded document whose
  node with `data.measure` sits on a content layer). The painter matches any node whose data has `measure.start`
  and `measure.end`, and `measureEndSource` walks every render-order node, so it still draws and still offers its
  ends as snap targets; but `measureIds`, and so `measureHitAt`, `currentMeasureId` and Clear all, read only
  `ms.layer`, so nothing in the package can pick, drag, delete or clear it. Which nodes are measurements is
  answered two ways.
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

<!-- done: 4 findings, files read: 21 -->
