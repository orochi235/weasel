# Audit round 35 — apps.draw.src.surfaces

Tree read: HEAD 6636588122 (the checkout's HEAD; the brief names 197362e015 as the frozen commit).

## Offset's distance is popover-local state, so it resets whenever the bar's popover closes or the asset changes surface
- where: apps/draw/src/surfaces/pathCommandAssets.tsx:44 and :47 (PATH_COMMAND_ASSETS `pathCommands` renderers)
- scenario: The `pathCommands` asset is on its default `bar` surface. The user opens the Offset popover, drags the slider to 30, and closes it. When they open it again, the slider is back at `DISTANCE.default`. The same thing happens if they switch the asset to `panel`: the distance resets. The cause is that `OffsetSlider` (apps/draw/src/ui/PathCommands/PathCommands.tsx:64) keeps `distance` in its own `useState`. The bar renderer mounts it inside `BarPopover`, a react-aria `DialogTrigger`/popover whose content is unmounted while closed, and the panel renderer mounts a separate instance. Simplify, the leaf next to it, goes through `HostSimplify`, so its tolerance comes from the host (a tool-option pref) and survives both. The contract in types.ts (`AssetLeafRenderer`: "what it shows comes from hooks, so it reads the same state on every surface") and in SchemaSurfaces.tsx (`useAssetBinding`: "moving an asset between surfaces keeps what it shows") says Offset should keep its value the same way.
- evidence: read. I did not run the unmount-on-close behavior; it comes from react-aria's Popover rendering nothing while closed.
- severity: medium

## useEditorSurfaceHost's memo misses on every render, because setSimplifyTolerance is a new function each time
- where: apps/draw/src/surfaces/useEditorSurfaceHost.ts:20-27 (useEditorSurfaceHost)
- scenario: `useSimplifyTolerance()` (apps/draw/src/ui/PathCommands/PathCommands.tsx:28) returns `set` as an inline arrow built fresh on every call. `setSimplifyTolerance` is in the `useMemo` deps, so each Editor render produces a new `SidebarHost` object. That new value goes into `SurfaceHostContext.Provider`, so every consumer re-renders on every Editor render even when no host field changed: `usePropertiesBinding`, `HostSimplify`, `HostFillets`, and the sidebar panels that read the host. The memo was written to prevent exactly that, and it never takes effect.
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
