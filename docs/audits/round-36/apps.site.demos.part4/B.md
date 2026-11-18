# Audit round 36 findings: apps.site.demos.part4

## The "joint labels" checkbox also hides both captions, which sit on the same `labels` layer
- where: apps/site/demos/RigDemo.tsx:126 (caption) and :237 (`setLayerVisible('labels', labels)`)
- scenario: `caption()` puts `caption:slider` ("holds on rig.target, by weight and joint") and `caption:track` ("SampledTrack<SkeletonPose> on rig.target") on layer `'labels'`, the layer the checkbox toggles. Unchecking "joint labels" hides the joint names, which is what it says, and also both explanatory captions under the figures. The captions should stay visible: they belong on a layer of their own, or the checkbox should toggle only the joint-label nodes.
- evidence: read
- severity: low

## RepeatAlongLab seeds its copies node from the schema defaults, not the trial's config, so a seeded trial or a Reset shows settings the panel doesn't
- where: apps/site/demos/RepeatAlongLabDemo.tsx:49 (createLabScene)
- scenario: `createLabScene` builds the `copies` effect with `settingsOf(config.defaults())` and never sees `ctx.config`. `useTrialScene` calls `create` again on Reset, and `resetTrial` (packages/labkit/src/trial/trialOps.ts:127) restores the config to `seedConfig(defaults, current.configSeed)`. In a trial added with a config seed (say Copies 20, Spacing 30), the scene opens and re-opens after Reset with 9 copies spread end to end, while the panel reads 20 / 30. Nothing reconciles them until the next panel change, because `usePathEffectSettings` only fires `editPathEffect` on a change. StrokeTrimLabDemo handles the same case the other way: `createLabScene(ctx.config)`, seeding from the live config.
- evidence: read
- severity: low

## RectPathEditLab's path-edit host outlives a trial Reset, so a reset trial doesn't reopen on rect-1
- where: apps/site/demos/RectPathEditLabDemo.tsx:89 (RectPathEditTrial, `useState(() => createPathEditHost({ id: FIRST }))`)
- scenario: the host is component state created once, and it opens `rect-1` in path edit. Reset sends `state.scene` back to null, and `useTrialScene` reloads the fresh contents into the same `Scene` without remounting the trial (per its doc, "a canvas holding it keeps its reference"), so the host keeps whatever it last had open. Open rect-3's path and press Reset: the scene comes back with rect-1 selected, but rect-3 is still in path edit (or nothing is, if Done was pressed), and the panel's Edit path / Done buttons and the "(editing)" marker follow the stale host. A fresh trial opens with rect-1 editing. Labs that use `defaultPathEdit` (RepeatAlong, Spiro, SegmentType) leave the opening to the canvas instead.
- evidence: read (the no-remount on Reset is inferred from useTrialScene.ts's doc and hook shape, not run)
- severity: low

## RegistryDemo's registry is a module singleton, so its entries survive unmount and are shared by every mounted copy
- where: apps/site/demos/RegistryDemo.tsx:22 (`const cursors = createReflectable(...)` at module scope)
- scenario: push "kit" and "plugin" cursors, navigate to another demo, come back: the table still lists the earlier registrants and the version counter keeps counting, because teardown never clears them. Two instances of the demo on one page (the site's gallery and a docs embed) share the same registry, so a press in one shows up in the other. The registry should be created per mount (for example `useState(() => createReflectable(...))`), or cleared on unmount.
- evidence: read
- severity: low

## Files read
apps/site/demos/QuantityDemo.tsx
apps/site/demos/ReachLabDemo.tsx
apps/site/demos/RectPathEditLabDemo.module.css
apps/site/demos/RectPathEditLabDemo.tsx
apps/site/demos/RegistryDemo.module.css
apps/site/demos/RegistryDemo.tsx
apps/site/demos/RenderToPixelsDemo.tsx
apps/site/demos/RepeatAlongLabDemo.tsx
apps/site/demos/ResampleLabDemo.tsx
apps/site/demos/ResizeSnapDemo.tsx
apps/site/demos/RigDemo.tsx
apps/site/demos/RigToolsDemo.tsx
apps/site/demos/RotatedResizeMathDemo.css
apps/site/demos/RotatedResizeMathDemo.tsx
apps/site/demos/RoutingDemo.module.css
apps/site/demos/RoutingDemo.tsx
apps/site/demos/RulersDemo.tsx
apps/site/demos/SandLabDemo.tsx
apps/site/demos/SceneDemo.tsx
apps/site/demos/SceneLabDemo.tsx
apps/site/demos/SceneScrollerDemo.module.css
apps/site/demos/SceneScrollerDemo.tsx
apps/site/demos/ScopedGridDemo.tsx
apps/site/demos/ScoreDemo.module.css
apps/site/demos/ScoreDemo.tsx
apps/site/demos/ScrollingGridDemo.tsx
apps/site/demos/SegmentTypeLabDemo.tsx
apps/site/demos/SelectDemo.module.css
apps/site/demos/SelectDemo.tsx
apps/site/demos/SelectionPanelDemo.tsx
apps/site/demos/SequenceDiagramDemo.tsx
apps/site/demos/ShapeBuilderLabDemo.tsx
apps/site/demos/ShapeToolsDemo.tsx
apps/site/demos/SharedBrushSizeDemo.tsx
apps/site/demos/SkinDemo.tsx
apps/site/demos/SliceDemo.tsx
apps/site/demos/SlideNavigationDemo.tsx
apps/site/demos/SmallCapsDemo.tsx
apps/site/demos/SnipLabDemo.tsx
apps/site/demos/SpacingHintsLabDemo.tsx
apps/site/demos/SpiroLabDemo.tsx
apps/site/demos/StickyNotesDemo.tsx
apps/site/demos/StrokeAndFillDemo.tsx
apps/site/demos/StrokeMarkersDemo.tsx
apps/site/demos/StrokeTrimLabDemo.module.css
apps/site/demos/StrokeTrimLabDemo.tsx
apps/site/demos/StrokeWidthLabDemo.tsx
apps/site/demos/SvgDemo.module.css
apps/site/demos/SvgDemo.tsx

<!-- done: 4 findings, files read: 49 -->
