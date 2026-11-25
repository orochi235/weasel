# Audit round 75 — apps.draw.src.surfaces

No defects found. Paths checked and cleared:

- Migration order in `apps/draw/src/prefs.ts` `MIGRATIONS` matches each migration's "Version N to N+1" doc, and
  the path-aid keys chain correctly through `pathAidsToGroup` → `renamePathAids` → `featureSettingsToGroups`.
- `renamePathTools`: `ToolbarLayout.floating` is required (`packages/ui/src/components/ToolbarDock/layout.ts:48`), so
  the guard that `floating` exists drops nothing valid. A `fillets` duplicated across dock rows is deduplicated by
  `resolveLayout`.
- The Properties paper enum's Custom option is `disabled` (`paperSizes.ts:18`), so its `onChange` dropping
  `'custom'` is unreachable.
- Stored `order` is written only by `SchemaBar` (dock assets). The panel and menu surfaces both read it, and
  command-row assets never get one, so `CommandBarSurface` not reading `order` loses nothing.

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

<!-- done: 0 findings, files read: 16 -->
