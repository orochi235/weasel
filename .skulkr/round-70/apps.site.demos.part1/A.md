# Findings: apps.site.demos.part1

## The last capture's object URL is never revoked when the demo unmounts, and survives into the next mount
- where: apps/site/demos/AnnotationCaptureDemo.tsx:23 (`latest` / `publish`)
- scenario: capture a PNG ×4, navigate away from the demo, come back. `latest` is module state and `publish` only revokes the previous URL when a new capture replaces it, so the blob (a 4× PNG) stays alive for the page's life, and the remounted `CapturePanel` shows the old capture from a previous mount (possibly at another hue) as "The last capture". Nothing revokes it on unmount.
- evidence: read
- severity: low

## Per-card effect entries are never deleted, so the effects map grows with every card ever added
- where: apps/site/demos/AnimationDemo.tsx:55 (`effects`, `getEffect`, `addBatch`)
- scenario: press "Add 5" repeatedly and remove the cards. `addBatch` seeds an entry per new id and `getEffect` creates one per breathing focus; `removeSelected` never deletes them, so the map holds an entry for every id ever minted, unbounded for the session.
- evidence: read
- severity: low

## The weasel-mark load has no error path, so one failed load disables the Ripple panel for the page's life
- where: apps/site/demos/CustomShaderDemo.tsx:41 (`loadWeaselMark`)
- scenario: the PNG request fails (offline, 404 after a deploy). `img.onerror` is never set, so `markLoad`'s promise never settles, `tex` stays null and the Ripple panel renders `disabled` (draws nothing) with no message. Because `markLoad` is cached at module scope, every later mount awaits the same dead promise, so even a remount after the network returns never retries.
- evidence: read
- severity: low

## Pinned Columns and Gap can make the cell width negative, and the bars then overlap and run past the grid
- where: apps/site/demos/AutoControlsDemo.tsx:79 (`grid` layer `draw`)
- scenario: set Width 240, pin Columns to 16 and Gap to 48 (all in range). `cell = (240 − 48·15)/16 = −30`; each bar is drawn 1px wide at `i·(cell + gap) = 18·i`, so the 16 bars step 18px apart and the last one sits at 270, past the 240-wide background, instead of fitting the grid. Only the bar width is clamped (`Math.max(cell, 1)`), not the stride or the gap.
- evidence: read
- severity: low

## Files read
apps/site/demos/AddExtremesLabDemo.tsx
apps/site/demos/AlignDemo.tsx
apps/site/demos/AlignmentGuidesDemo.tsx
apps/site/demos/AnchorFieldsLabDemo.tsx
apps/site/demos/AnchorSelectLabDemo.tsx
apps/site/demos/AnimationDemo.module.css
apps/site/demos/AnimationDemo.tsx
apps/site/demos/AnimatorDemo.module.css
apps/site/demos/AnimatorDemo.tsx
apps/site/demos/AnnotationCaptureDemo.tsx
apps/site/demos/AudioDemo.tsx
apps/site/demos/AutoControlsDemo.tsx
apps/site/demos/BendAlongLabDemo.tsx
apps/site/demos/BidiDemo.module.css
apps/site/demos/BidiDemo.tsx
apps/site/demos/BooleanOpsDemo.tsx
apps/site/demos/BridgeLabDemo.tsx
apps/site/demos/CanvasViewDemo.module.css
apps/site/demos/CanvasViewDemo.tsx
apps/site/demos/ClipDemo.module.css
apps/site/demos/ClipDemo.tsx
apps/site/demos/ClockDemo.module.css
apps/site/demos/ClockDemo.tsx
apps/site/demos/ClothWarpLabDemo.tsx
apps/site/demos/ColorMatrixDemo.module.css
apps/site/demos/ColorMatrixDemo.tsx
apps/site/demos/CompoundPathsDemo.module.css
apps/site/demos/CompoundPathsDemo.tsx
apps/site/demos/ContextMenuDemo.tsx
apps/site/demos/CursorDemo.module.css
apps/site/demos/CursorDemo.tsx
apps/site/demos/CurvatureCombLabDemo.tsx
apps/site/demos/CurveLabDemo.tsx
apps/site/demos/CustomShaderDemo.module.css
apps/site/demos/CustomShaderDemo.tsx
apps/site/demos/D3SortableDemo.tsx
apps/site/demos/DebugOverlayDemo.tsx
apps/site/demos/DemoStage.tsx
apps/site/demos/DevtoolsDemo.module.css
apps/site/demos/DevtoolsDemo.tsx
apps/site/demos/DiagramClustersDemo.tsx
apps/site/demos/DiagramDataDemo.tsx
apps/site/demos/DiagramDrawOnDemo.tsx
apps/site/demos/DiagramDropDemo.module.css
apps/site/demos/DiagramDropDemo.tsx
apps/site/demos/DiagramEdgesDemo.tsx
apps/site/demos/DiagramElkDemo.tsx
apps/site/demos/DiagramLayoutDemo.tsx

<!-- done: 4 findings, files read: 48 -->
