# Findings: path-tools.part2

## Retargeting an effect's path or spine keeps a stale `foundHidden` entry, so the new source is hidden for good
- where: packages/path-tools/src/pathEffects/hiding.ts:51 (takenOps); callers packages/path-tools/src/pathEffects/retarget.ts:66 (setEffectPathAction), packages/path-tools/src/pathEffects/spine.ts:64 (setTweenSpineAction), packages/path-tools/src/pathEffects/spine.ts:103 (releaseTweenSpineAction)
- scenario: A Text Along Path (hideSources) is made along a path that was already hidden, so the effect records `foundHidden: [1]`. Set Path retargets it to a visible path: `takenOps` takes the `hiddenOps` branch and hides the new path, but never drops `1` from `foundHidden`. `sourcesHiddenBy` filters by position, so it no longer counts the new path as hidden by the effect: releasing, expanding or deleting the effect never shows it again (`releasedOps` sees `held === false`, `hiddenSourcesTakenWith` skips it). The path stays hidden after the effect is gone. Releasing a tween's spine has the same problem: `releaseTweenSpineAction` cuts `dependsOn` to two entries and leaves `foundHidden` holding `2`, so the next Set Spine hides its spine under that stale index. `takenOps` should remove `at` from `foundHidden` when it hides the source itself, and a spine release should drop index 2.
- evidence: read (sourcesHiddenBy in packages/core/src/domains/pathEffects/hiddenSources.ts:21-22 filters by `foundHidden` index)
- severity: medium

## `facesAlong` hangs when `step` is 0 or negative
- where: packages/path-tools/src/shapeBuilder/shapeBuilder.ts:101 (facesAlong)
- scenario: `facesAlong` is public (re-exported from `shapeBuilder/index.ts`) and takes `step` as a bare world distance with no guard. With `step === 0` and a run of two distinct points, `Math.ceil(d / 0)` is `Infinity`, so `n` is `Infinity` and the inner `for (s <= n)` loop never ends: the tab freezes. A negative step gives `-Infinity`, `Math.max(1, …)` turns it into 1, and the run quietly samples only its endpoints. The built-in action guards its own step (`shapeBuilderActions.ts:125`); an outside caller gets no such guard. A non-positive or non-finite `step` should fall back to a single sample per segment, or throw.
- evidence: read
- severity: low

## Files read
packages/path-tools/src/knead/useKneadTool.ts
packages/path-tools/src/outlines/createOutlines.ts
packages/path-tools/src/outlines/createOutlinesAction.tsx
packages/path-tools/src/outlines/outlineStroke.ts
packages/path-tools/src/outlines/outlineStrokeAction.tsx
packages/path-tools/src/outlines/replaceWithPaths.ts
packages/path-tools/src/outlines/useCreateOutlinesAdapter.ts
packages/path-tools/src/overlays/showOverlay.ts
packages/path-tools/src/pathCommands/cutJoin.ts
packages/path-tools/src/pathCommands/joinAnchorData.ts
packages/path-tools/src/pathCommands/livePathEdit.ts
packages/path-tools/src/pathCommands/pieceOrigins.ts
packages/path-tools/src/pathCommands/simplifyOffset.ts
packages/path-tools/src/pathEffects/actions.ts
packages/path-tools/src/pathEffects/effectForms.ts
packages/path-tools/src/pathEffects/hiding.ts
packages/path-tools/src/pathEffects/params.ts
packages/path-tools/src/pathEffects/retarget.ts
packages/path-tools/src/pathEffects/settingsForm.ts
packages/path-tools/src/pathEffects/spine.ts
packages/path-tools/src/pathStructure/directionMarks.ts
packages/path-tools/src/pathStructure/pathStructure.ts
packages/path-tools/src/pathsPreset.ts
packages/path-tools/src/pbt.fixture.ts
packages/path-tools/src/pencil/usePencilTool.tsx
packages/path-tools/src/poise/poiseHandles.ts
packages/path-tools/src/poise/poiseMarks.ts
packages/path-tools/src/presets.ts
packages/path-tools/src/reach/reachToMeet.ts
packages/path-tools/src/reach/useReachTool.ts
packages/path-tools/src/resample/resample.ts
packages/path-tools/src/sand/sand.ts
packages/path-tools/src/sand/useSandTool.ts
packages/path-tools/src/segmentType/convertSegments.ts
packages/path-tools/src/settingsFields.ts
packages/path-tools/src/shapeBuilder/index.ts
packages/path-tools/src/shapeBuilder/shapeBuilder.ts

<!-- done: 2 findings, files read: 37 -->
