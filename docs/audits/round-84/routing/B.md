# Audit round 84 — routing (blind reviewer)

## A menu `action` leaf naming a multi-variant action, and every `actions` leaf, drop the leaf's `access`
- where: packages/routing/src/menus/resolveMenu.ts:156 (actionRows), packages/routing/src/menus/resolveMenu.ts:169 (rowsOf, case 'actions')
- scenario: a schema leaf `{ kind: 'action', action: 'align', access: 'A' }` where `align` has several variants, or a `{ kind: 'actions', group, access }` leaf. `actionRows` passes `leaf.access` to `itemOf` only on the one-item path; the `items.map(...)` path calls `itemOf(ctx, it, key, label, off)` with no access, and the `actions` case never passes it either. The rows come out with no `access` key, so the access key the author declared is gone exactly when the action is parametric; it should be on every row the leaf produces, as it is for the single-variant case.
- evidence: read
- severity: low

## Enum rows drop the leaf's `access`, unlike every other value row
- where: packages/routing/src/menus/valueRows.ts:50 (enumRows)
- scenario: a `pref.enum(..., { access: 'M' })` leaf drawn in a menu. `booleanRows`, `numberRows`, `colorRows`, `stringRows` (readout too) all spread `withAccess(leaf.access)`; `enumRows` spreads it on neither its readout row nor its radio option rows, so the access key never reaches the menu for an enum. Expected: the readout row, and the option rows (or at least the first), carry it as the other kinds do.
- evidence: read
- severity: low

## `useContributions` reads the mode version with no server snapshot, so it throws under server rendering
- where: packages/routing/src/contributions/useContributions.ts:102 (useContributions)
- scenario: any server render (`renderToString`) of a tree that calls `useContributions` / `<SceneCanvas>`. `useSyncExternalStore` is called with two arguments; React throws "Missing getServerSnapshot" on the server. Every other store read in the package (`usePointerPosition`, `useElementSize`, `useToolOptionValues`, activeToolContext, toolsScope, useToolShortcuts, useLastOperation) passes the third argument, so the decision is answered two ways. (`useInnermostKeymap` and `useOpenKeymap`, outside this list, have the same gap.)
- evidence: read
- severity: low

## A drop and the drag over it disagree on a string item with no type
- where: packages/routing/src/ingestion/ingestItems.ts:86 (itemsFromDataTransfer) vs packages/routing/src/ingestion/ingestItems.ts:120 (itemTypesFromDataTransfer)
- scenario: a `DataTransfer` string item whose `type` is `''`, with `application/octet-stream` admitted through `admitIngestMime` (a content handler naming that MIME). On `drop`, `normalizeMime('')` gives `application/octet-stream`, which is kept, so the item is materialized; during `dragover`, `itemTypesFromDataTransfer` maps an empty type to `''`, which `keepsString` refuses, so the pending list omits it. The bindings asked "would this drop match" during the drag answer no, the drop answers yes: no preview and no drop-effect for a drop that will be taken. Both paths should normalize an untyped string the same way.
- evidence: read
- severity: low

## Files read
packages/routing/src/ambient/PointerContext.tsx
packages/routing/src/ambient/SelectionContext.tsx
packages/routing/src/contributions/assemble.ts
packages/routing/src/contributions/eligibility.ts
packages/routing/src/contributions/heldModifier.ts
packages/routing/src/contributions/index.ts
packages/routing/src/contributions/merge.ts
packages/routing/src/contributions/modeShortcuts.ts
packages/routing/src/contributions/types.ts
packages/routing/src/contributions/useContributions.ts
packages/routing/src/dlog.ts
packages/routing/src/eligibility/deviceProfile.ts
packages/routing/src/eligibility/exclusive.ts
packages/routing/src/eligibility/index.ts
packages/routing/src/eligibility/rule.ts
packages/routing/src/eligibility/ruleCtx.ts
packages/routing/src/index.ts
packages/routing/src/ingestion/ingestItems.ts
packages/routing/src/internal.ts
packages/routing/src/kitSettings.ts
packages/routing/src/menus/MenuHostContext.tsx
packages/routing/src/menus/compoundRows.ts
packages/routing/src/menus/menuHost.ts
packages/routing/src/menus/paths.ts
packages/routing/src/menus/pickMenu.ts
packages/routing/src/menus/resolveMenu.ts
packages/routing/src/menus/separators.ts
packages/routing/src/menus/types.ts
packages/routing/src/menus/valueRows.ts
packages/routing/src/pbt.fixture.ts
packages/routing/src/react.ts
packages/routing/src/testing/registerAction.tsx
packages/routing/src/viewport/clientToCanvas.ts
packages/routing/src/viewport/useElementSize.ts
packages/routing/src/vocabulary.ts

<!-- done: 4 findings, files read: 35 -->
