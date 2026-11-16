---
'@weasel-js/core': minor
---

`@weasel-js/core` exports the actions and helpers `@weasel-js/editing` builds on, for a package that edits on core's public surface.

The edit actions its presets register: `cancelGestureAction`, `escapeAction`, `selectAllAction`, `duplicateAction`, `transformAgainAction`, `groupAction`, `ungroupAction`, the `nudge*Action`s, the `setFill`, `setFillOpacity`, `setStroke`, `setStrokeOpacity`, `setStrokeWidth` and `setVertexColor` actions, `ingestAction`, the `pathfinder*Action`s and `makeBooleanGroupAction`; `toolDrivenActions`, `PRESET_CHROME` and `PRESET_OWNED_CHROME`. The helpers: `moveEachOps`, `uncarried`, `shapeSources`, `commitTransformOps`, `transformApplyOps`, `poseFrame`, `poseDescriptorOf`, `settleWithinRounding`, `actionReferenceSources`, `finiteThroughout`, `geometryDataOp`, `isNoInkExtents`, `sameValue`, and `bringForward`, `bringToFront`, `sendBackward` and `sendToBack`. `@weasel-js/core/test-seams` adds `makeFrameFixtureForTests`, `expectSamePoseForTests`, `FRAME_FIXTURE_IDSForTests`, `FRAME_FIXTURE_LOCALForTests`, `pbtRunsForTests`, `pbtTallyForTests` and `pbtTimeoutForTests`.

<!-- entry: api -->
