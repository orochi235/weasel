# Audit round 75 — apps.draw.src.surfaces

## A command-row asset drawn as a bar ignores its stored item order, while the same asset as a menu or panel honors it
- where: apps/draw/src/surfaces/CommandSurfaces.tsx:30 (CommandSlot → CommandBarSurface)
- scenario: a command-row asset (e.g. `view`) with `ui.surfaces.view.order` set (by Preferences, or carried over from when it was reordered) → `CommandSlot` passes `order` to `SchemaMenu` and `SchemaPanel` applies it, but `CommandBarSurface` neither takes nor forwards `order` to `PrefsBar`, so the bar shows schema order and the same asset lists its items differently on two surfaces. The order is answered two ways for one asset; the bar path should pass `order` (and `onReorder`) as `SchemaBar` does.
- evidence: read
- severity: low

## The View menu's "screen order" is fixed by each asset's default surface, not the one it is on
- where: apps/draw/src/surfaces/chrome.tsx:22 (CHROME_ITEMS)
- scenario: move Colors (default `panel`) to a toolbar, or Arrange (default `bar`) to a panel → `CHROME_ITEMS` still lists Colors among the sidebar panels after Tools and Arrange among the dock's bars before it, because the split filters on `defaultSurface` at module load; the doc comment promises screen order, which the list then contradicts. Either derive the order from the current surface or drop the screen-order claim.
- evidence: read
- severity: low

## Files read
apps/draw/src/surfaces/CommandSurfaces.tsx
apps/draw/src/surfaces/SchemaSurfaces.module.css
apps/draw/src/surfaces/SchemaSurfaces.tsx
apps/draw/src/surfaces/StripSurfaces.tsx
apps/draw/src/surfaces/appLeaves.tsx
apps/draw/src/surfaces/assets.tsx
apps/draw/src/surfaces/chrome.tsx
apps/draw/src/surfaces/hostContext.ts
apps/draw/src/surfaces/panelAssets.tsx
apps/draw/src/surfaces/pathCommandAssets.module.css
apps/draw/src/surfaces/pathCommandAssets.tsx
apps/draw/src/surfaces/prefsMigration.ts
apps/draw/src/surfaces/surfaceState.ts
apps/draw/src/surfaces/surfaceSwitch.tsx
apps/draw/src/surfaces/types.ts
apps/draw/src/surfaces/useEditorSurfaceHost.ts

<!-- done: 2 findings, files read: 16 -->
