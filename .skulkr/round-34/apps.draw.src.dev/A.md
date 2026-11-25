# Audit round 34 — apps.draw.src.dev

## The Resolution widget's "active tool" is the first registry id alphabetically, not the canvas's active tool
- where: apps/draw/src/dev/ToolkitBuilder.tsx:107 (ToolkitForSetup); apps/draw/src/dev/toolkit/useToolReflection.ts:24 (onToolsCreated)
- scenario: mount `draw` + `tools:shape`. The canvas's active tool is, say, `select`, but `activeToolId={reflection.slots.registry[0]}` passes the first id of `Object.keys(registry).sort()` (e.g. `ellipse`). `resolveAll` then ranks that tool's active-tier bindings as live and the real active tool's as inactive, so the Resolution table shows the wrong winner. Picking another tool on the canvas doesn't update it either, because the reflection signature hashes only tool ids and never `api.active`/`api.routed`. It should pass `api.routed ?? api.active` and include it in the signature.
- evidence: read (ToolsApi.active/routed in packages/routing/src/tools/useTools.ts:44-51)
- severity: medium

## The Resolution widget's `key` gesture can never match a binding
- where: apps/draw/src/dev/toolkit/ResolutionWidget.tsx:121 (candidates memo); apps/draw/src/dev/resolutionInput.ts:92 (synthesizeInput)
- scenario: pick gesture `key`. The widget calls `synthesizeInput({ gesture, target, mods })` without a `key`, so the event is `{ kind: 'key', key: '' }`. No key binding names the empty key, so the table always reads "No binding matches this input." The picker offers this gesture but gives no way to choose which key.
- evidence: read
- severity: medium

## Source lookup globs the wrong directories: kit symbols never resolve, and draw links point at a nonexistent path
- where: apps/draw/src/dev/sourceLookup.ts:66-75 (rawSources glob); apps/draw/src/dev/detail/sourceLinks.tsx:73 (SourceLink)
- scenario: draw's Vite `root` is `apps/draw` (apps/draw/vite.config.ts:22), and a leading-`/` `import.meta.glob` pattern resolves against the root. So `'/src/**'` is draw's own source, and `'/apps/draw/src/**'` is `apps/draw/apps/draw/src`, which matches nothing. No package source is ever loaded. `findSourceMatch('createInsertOp')`, `findSourceMatch('useRectTool')`, op-kind factories and icons all return null, so the inspector's "source" row and JSDoc never appear for any kit symbol. For the draw files it does find, the glob key is `/src/...`, so `SourceLink` builds `vscode://file/<repoRoot>/src/...:N`, where the right path is `<repoRoot>/apps/draw/src/...`.
- evidence: read
- severity: medium

## The Properties category never lists the kinds draw's presets add (text), because the probe reports core's defaults
- where: apps/draw/src/dev/registryProbe.tsx:156 (RegistryProbe effect); apps/draw/src/dev/RegistryInspector.tsx:39,56; apps/draw/src/dev/registryData.ts:194 (collectPropertiesTrait)
- scenario: the probe mounts `DRAW_FEATURES` (`drawPreset, pathTools, textPreset`), and `textPreset` contributes `properties: [TEXT_PROPERTIES]` (packages/text-tools/src/presets.ts:49). But the snapshot always sends `properties: defaultNodeProperties`, core's base list. The `nodeTraitsOf(DRAW_FEATURES, …)` fallback in `collectPropertiesTrait` is unreachable, because the inspector seeds `properties: []` rather than `undefined`. So Traits › Properties lists no `text` entry, although draw's canvases expose it. The probe should report `nodeTraitsOf(DRAW_FEATURES, { properties: defaultNodeProperties }).properties`, which is what its canvas merges.
- evidence: read
- severity: medium

## Draw's own action glyphs are listed twice under one id, as an `action` icon and as an `app` icon
- where: apps/draw/src/dev/registryData.ts:56 (collectIcons)
- scenario: the probe registers draw's app commands (`appCommands/actions.tsx`: `icon('symmetry')`, `icon('releaseCompound')`, `icon('settings')`, `icon('ui:grid')`…). `collectActionIcons` emits `draw:symmetry` etc. with `source: 'action'`, and then the `ICON_GROUPS` loop pushes `draw:symmetry` again with `source: 'app'`, with no check for an existing id. The Icons category ends up with two entries whose `entryKey` is `icon:draw:symmetry`. That gives RegistryBrowser duplicate entry ids and React keys. `onSelect`/`onNavigate`/the deep-link drain always `find` the first one, so the `app` row can never be selected on its own, and both rows highlight together. The app loop should skip refs the action pass already listed, or merge them into one entry.
- evidence: read (apps/draw/src/icons.gen.ts:21-23 lists these names in ICON_GROUPS)
- severity: medium

## The inspector's selected entry is a stale snapshot: its detail never updates when the probe's snapshot arrives
- where: apps/draw/src/dev/RegistryInspector.tsx:99-116 (selection reconcile / deep-link drain), :176 (RegistryDetail entry={selected})
- scenario: open `#/dev/registry?kind=shapeKind&id=rect`. On the first render `runtime.tools` is `[]`, so `collectShapeTrait` builds `rect` with `hookName: undefined` and the fallback icon, and the deep link drains immediately into that object. When the probe snapshot lands, `nodes` is rebuilt with `hookName: 'useRectTool'`, but `selected` keeps the old object, matched only by kind+id. `ShapeKindDetail` keeps showing "authored by rect", looks up source by `rect` rather than the hook, and shows the wrong icon until the user re-clicks. The same goes for an icon whose `actions` list grows. The selection should be stored as kind+id and resolved against `nodes` on each render.
- evidence: read (ShapeKindDetail reads entry.hookName/entry.icon, apps/draw/src/dev/detail/KindDetail.tsx:21-36)
- severity: medium

## Every shape kind's "op factories" links go nowhere: the tree has no op-factory category
- where: apps/draw/src/dev/detail/KindDetail.tsx:39-44 (ShapeKindDetail); apps/draw/src/dev/RegistryInspector.tsx:67-78,181-186 (nodes, onNavigate)
- scenario: open Traits › Shape › rect and click `createInsertOp`. `EntryLink` calls `onNavigate({ kind: 'opFactory', id: 'createInsertOp' })`. `onNavigate` searches `nodes`, but no category holds `opFactory` entries (`collectOpFactories` is never put in the tree; `ops` holds `opKind` entries), so it finds nothing and silently does nothing. Each of the four links renders as a button and none of them works. They should target the `opKind` entries (`insert`, `delete`, …), or the tree should carry an op-factory category.
- evidence: read
- severity: low

## A deep link that has not resolved yet keeps waiting, and later overrides the user's own pick
- where: apps/draw/src/dev/RegistryInspector.tsx:108-116 (pendingDeepLink drain), :119-121, :124-133
- scenario: open `#/dev/registry?kind=icon&id=core:undo`. That entry exists only after the probe snapshot, so it is queued, and the mount effect immediately `replaceState`s the hash to `#/dev/registry`. If the user clicks another entry before the snapshot lands, `pendingDeepLink` is still set (only a successful drain clears it, never `onSelect`/`onNavigate`). When the snapshot adds `core:undo`, the render-time drain yanks the selection back to it. A hashchange that resolves directly doesn't clear an older pending link either. Selecting anything should clear `pendingDeepLink`.
- evidence: read
- severity: low

## Gesture pages and counts ignore 7 of the 16 catalogued gesture kinds on tools
- where: apps/draw/src/dev/registryProbe.tsx:236 (summarizeSurface); apps/draw/src/dev/registryData.ts:110 (countForEntry); apps/draw/src/dev/detail/GestureDetail.tsx:75
- scenario: `GESTURE_CATALOG_KEYS` lists `pinch`, `multiTouch`, `hover`, `longPress`, `drop`, `carry` and `paste`, but `summarizeSurface` seeds only 9 keys and drops any other binding kind (`hasOwnKey` guard). For a tool binding `{ kind: 'longPress' }` (hud's tool, packages/hud/src/tool.ts:236) or `pinch` (kernel3d), the Gestures › longPress page reads "No tools subscribe" and its leaf count omits the tool. Both should read the tool's binding kinds directly, or seed the surface from `GESTURE_CATALOG_KEYS`.
- evidence: read
- severity: low

## Files read
apps/draw/src/dev/AssetsPage.module.css
apps/draw/src/dev/AssetsPage.tsx
apps/draw/src/dev/DevShell.tsx
apps/draw/src/dev/DevtoolsSidebarPanel.module.css
apps/draw/src/dev/DevtoolsSidebarPanel.tsx
apps/draw/src/dev/RegistryDetail.tsx
apps/draw/src/dev/RegistryInspector.module.css
apps/draw/src/dev/RegistryInspector.tsx
apps/draw/src/dev/SchemaTable.tsx
apps/draw/src/dev/ToolkitBuilder.module.css
apps/draw/src/dev/ToolkitBuilder.tsx
apps/draw/src/dev/badgeTokens.ts
apps/draw/src/dev/detail/BundleDetail.tsx
apps/draw/src/dev/detail/ExportsDetail.tsx
apps/draw/src/dev/detail/GestureDetail.tsx
apps/draw/src/dev/detail/IconDetail.tsx
apps/draw/src/dev/detail/KindDetail.tsx
apps/draw/src/dev/detail/MetaDetail.tsx
apps/draw/src/dev/detail/OpDetail.tsx
apps/draw/src/dev/detail/RouteBadge.tsx
apps/draw/src/dev/detail/SlotDetail.tsx
apps/draw/src/dev/detail/shared.tsx
apps/draw/src/dev/detail/sourceLinks.tsx
apps/draw/src/dev/devRoutes.ts
apps/draw/src/dev/drawWorkspace.ts
apps/draw/src/dev/registryData.ts
apps/draw/src/dev/registryEntries.ts
apps/draw/src/dev/registryProbe.tsx
apps/draw/src/dev/resolutionInput.ts
apps/draw/src/dev/sourceLookup.ts
apps/draw/src/dev/toolkit/ActionsWidget.tsx
apps/draw/src/dev/toolkit/ConflictsWidget.tsx
apps/draw/src/dev/toolkit/DispatchTraceWidget.tsx
apps/draw/src/dev/toolkit/ResolutionWidget.tsx
apps/draw/src/dev/toolkit/RoutesWidget.tsx
apps/draw/src/dev/toolkit/ToolsWidget.tsx
apps/draw/src/dev/toolkit/gridCells.tsx
apps/draw/src/dev/toolkit/useToolReflection.ts
apps/draw/src/dev/traitSchemas.types.ts

<!-- done: 9 findings, files read: 39 -->
