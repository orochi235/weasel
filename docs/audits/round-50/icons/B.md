# Audit round 50: icons (blind reviewer)

## useIconGlyph and useIconVariant throw under server rendering: no getServerSnapshot
- where: packages/icons/src/react/useIconGlyph.ts:11 (useIconGlyph); packages/icons/src/react/useIconVariant.ts:13-14 (useIconVariant)
- scenario: an app server-renders (renderToString / renderToPipeableStream) any tree holding a component that calls `useIconGlyph` or `useIconVariant` (ui's `<Icon>`, the icon picker). React requires a third `getServerSnapshot` argument to `useSyncExternalStore` on the server, so it throws "Missing getServerSnapshot" and the render fails. It should render from the registry's current snapshot, the way the rest of the kit does: `packages/react/src/useKitSetting.ts:43`, `packages/core/src/core/scene/useScene.ts`, `usePublishSceneSelection.ts:36`, `useKeyModifiers.ts:12`, and `useAnchorFields.ts:55` all pass the reader a second time. The kit answers "what does a store hook do on the server" two ways.
- evidence: read (no SSR caller exists in-repo; this is a published React entry)
- severity: medium

## A variant that failed stays failed after its loader is replaced: mounted useIconVariant never retries
- where: packages/icons/src/variants.ts:21-28 (provide); packages/icons/src/react/useIconVariant.ts:16-20 (useIconVariant effect)
- scenario: `<IconRegistryProvider variants={{ all: loaderA }}>`. `loaderA` rejects (a chunk 404 during a deploy), so `variantState('all')` reads `'failed'`. The app then passes `variants={{ all: loaderB }}`. `provide` swaps the loader in but leaves the state `'failed'`, since only a name it has never seen turns `'idle'`, and it announces nothing. The mounted `useIconVariant('all')` effect depends on `[registry, name, idle]`, and none of those changed, so `loaderB` never runs until some component remounts. The same `provide` ignores a new loader for a `'loaded'` name completely (`load` returns early on `'loaded'`). A replaced loader should make the variant loadable again, for example by setting `'idle'` when the loader differs and the state is `'failed'`.
- evidence: read
- severity: low

## Files read
packages/icons/src/icons.gen.ts
packages/icons/src/icons.table.ts
packages/icons/src/index.ts
packages/icons/src/mark.ts
packages/icons/src/names.ts
packages/icons/src/pbt.fixture.ts
packages/icons/src/react.ts
packages/icons/src/react/IconRegistryProvider.tsx
packages/icons/src/react/useIconGlyph.ts
packages/icons/src/react/useIconVariant.ts
packages/icons/src/registry.ts
packages/icons/src/shapes.ts
packages/icons/src/spec.ts
packages/icons/src/table.ts
packages/icons/src/variants.ts

<!-- done: 2 findings, files read: 15 -->
