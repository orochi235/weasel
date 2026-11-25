# Audit round 35: `apps.draw.src.surfaces`

Note: the checkout's HEAD reads 6636588122, not the 197362e015 the brief names; findings cite that tree.

## A command-row asset hidden from its panel's × has no View-menu toggle to bring it back
- where: apps/draw/src/surfaces/chrome.tsx:22 (CHROME_ITEMS); apps/draw/src/surfaces/SchemaSurfaces.tsx:38 (SchemaPanel, `onHide={chrome.onHide}`)
- scenario: "Simplify and Offset" (`pathCommands`) or Fillet (`fillets`), both `row: 'command'` with `'panel'` allowed, is switched to its panel, then hidden with the panel's ×. `ui.surfaces.<id>.hidden` becomes true, so `RightSidebar` stops drawing the panel and `CommandSlot` (CommandSurfaces.tsx:25) draws nothing either, so there is no context menu to switch it back from. `CHROME_ITEMS` drops every `row === 'command'` asset, because "their names are the menus'", but these two are not the names of any menu, so the View menu has no "show" row for them (menuBar.ts:45 and appCommands/actions.tsx:108 both build from `CHROME_ITEMS`). The only way back is the Hidden column in Preferences (`ALL_CHROME`). Expected: an asset the user can hide from a panel stays reachable from the View menu, as every dock asset and default panel is. Alternatively the panel should not offer × for an asset the View menu cannot restore.
- evidence: read
- severity: medium

## Version 5→6 migration carries Corner shape's toolbar place in `docks` and `floating` but not in `atEnd`
- where: apps/draw/src/surfaces/prefsMigration.ts:89 (renamePathTools)
- scenario: `ToolbarLayout` keeps a bar's far-end placement in `atEnd` (packages/ui/src/components/ToolbarDock/layout.ts:50). The migration renames `corners` to `fillets` in `docks` rows and in `floating`, but copies `atEnd` through unchanged, so a stored `atEnd: ['corners']` stays pointing at a dead id and the renamed bar loses its far-end place. The two halves of one toolbar place are handled two ways. Separately, a row holding both `corners` and `fillets` keeps the stale `corners`. In practice `corners` was a `row: 'command'` asset from 2026-10-26 on (28fc6594de), and `stripBars` never docks command-row assets, so no saved layout should contain the id. The whole toolbar half of this rename is close to unreachable, and this one is incomplete as well.
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
