I couldn't write `.skulkr/out/findings.md` because the write permission was declined, so the whole document is below.

# Audit round 64: labkit.chrome (blind reviewer)

Commit 49e5a07e6aecc7037a5e3692706cf28dd58211c4 isn't in this clone (`git cat-file` says "bad object"). I read the working tree at HEAD 6f634fabe1 instead, which has no uncommitted changes under `packages/labkit/src/chrome`.

## A canvas trial whose view is not 2D gets no FPS meter, because the meter is gated on zoom
- where: packages/labkit/src/chrome/builtins.tsx:156 (zoomContributions)
- scenario: An instrument declares `canvas`, and its trial's view is not the 2D one and has no camera. `useTrialChromeContext` then reports `zoom: null` (`camera ? camera.zoomOf(record.view) : (view2d?.zoom ?? null)`). `zoomContributions` returns `[]` at `if (drawsDom(instrument) || zoom === null)`, before it reaches the `fps` push at line 198. So the trial never shows an FPS meter, even though the meter counts frames, not zoom, and `instrument.canvas != null` holds.
  - The comment above the function only says a non-2D view gets none of the zoom chrome. The TRANSIENT_BUILTINS comment ("FPS meter once the trial has a view") covers waiting for a view to be measured, not a view that never reports zoom.
  - What should happen: the `fps` status contribution depends only on `instrument.canvas`.
- evidence: read (builtins.tsx:154-206; trial/useTrialChromeContext.ts:139)
- severity: low

## The SuppressedAndReplaced story does not replace the built-in it suppresses
- where: packages/labkit/src/chrome/ChromeRegions.stories.tsx:82 (SuppressedAndReplaced)
- scenario: The story's doc says "A consumer dropping a built-in and adding its own in its place". It suppresses `snapshot` (the title bar's Save snapshot button) and adds a no-op `export` button to the toolbar instead.
  - `FullInstrument` declares no `annotations`, so there is never a built-in `export` for the new button to replace, and nothing takes snapshot's place.
  - Someone copying the story learns neither the suppress-then-redeclare pattern (which `SubjectTitleAndLead` does show, with `snapshot-in-toolbar`) nor what happens to a replaced built-in.
  - What should happen: the added contribution redeclares the suppressed one, or the instrument declares `annotations` and the story suppresses `export`.
- evidence: read
- severity: low

## Files read
packages/labkit/src/chrome/ChromeRegions.stories.tsx
packages/labkit/src/chrome/LabChrome.tsx
packages/labkit/src/chrome/builtins.tsx
packages/labkit/src/chrome/index.ts
packages/labkit/src/chrome/labTypes.ts
packages/labkit/src/chrome/merge.ts
packages/labkit/src/chrome/regions/OverlayRegion.tsx
packages/labkit/src/chrome/regions/PaletteRegion.less
packages/labkit/src/chrome/regions/PaletteRegion.tsx
packages/labkit/src/chrome/regions/SidebarPanes.stories.tsx
packages/labkit/src/chrome/regions/SidebarPanes.tsx
packages/labkit/src/chrome/regions/SidebarRegion.less
packages/labkit/src/chrome/regions/SidebarRegion.stories.tsx
packages/labkit/src/chrome/regions/SidebarRegion.tsx
packages/labkit/src/chrome/regions/StatusRegion.tsx
packages/labkit/src/chrome/regions/TitleBarRegion.tsx
packages/labkit/src/chrome/regions/ToolbarRegion.tsx
packages/labkit/src/chrome/regions/ViewportRegion.less
packages/labkit/src/chrome/regions/ViewportRegion.tsx
packages/labkit/src/chrome/regions/groupsOf.ts
packages/labkit/src/chrome/trialActions.tsx
packages/labkit/src/chrome/types.ts

<!-- done: 2 findings, files read: 22 -->