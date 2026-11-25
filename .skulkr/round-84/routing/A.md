# Audit round 84 — routing — blind reviewer findings

## A multi-variant action row (and an `actions` leaf's rows) drop the leaf's `access`
- where: packages/routing/src/menus/resolveMenu.ts:166 (actionRows), :181 (rowsOf `case 'actions'`)
- scenario: a menu schema has `pref.action({ action: 'align', access: 'A' })` where `align` has several variants → `items.length > 1`, so each row is built by `itemOf(ctx, it, …, off)` with no `access` argument; the access key the leaf declares is silently lost. The same leaf naming a one-variant action keeps it (`itemOf(…, leaf.access)`). One option, answered two ways depending on how many variants the action has. Either the first row, or a submenu holding the variants, should carry it.
- evidence: read
- severity: low

## An enum readout row drops the leaf's `access`, which every other readout row keeps
- where: packages/routing/src/menus/valueRows.ts:52 (enumRows, readout branch)
- scenario: `pref.enum('Units', …, { readout: true, access: 'U' })` → the row `{ kind: 'item', key, label: 'Units: px', disabled: true, run: noop }` has no `access`; a boolean readout (`booleanRows`, `withAccess(leaf.access)`) and a string readout (`stringRows`) both keep it. The accelerator the schema declares is silently dropped on this one path.
- evidence: read
- severity: low

## `usePublishSelection` leaves its token, and its selection, in the old provider when the provider in scope changes
- where: packages/routing/src/ambient/SelectionContext.tsx:117-136 (usePublishSelection)
- scenario: a publisher stays mounted while the `SelectionContextProvider` above it is swapped (the `store`/provider is replaced above a stable subtree, e.g. a keyed provider re-created around a memoized child). The publish effect reruns for the new `publish` and records the token in the new provider's `heldOf` map, but nothing deletes it from the old provider's map, and the old slot keeps the publisher's selection. The unmount cleanup only reads `ctxRef.current` (the newest provider), so the old provider's `held` keeps a live-looking entry forever: a later publisher in the old provider holding the same content then never clears the slot when it unmounts (`[...held.values()].includes(mine)` is true for the departed token). The publish effect should delete its token from the previous `publish`'s map (an effect cleanup keyed on `publish`).
- evidence: read
- severity: low

## `DepSchema`'s doc says it declares one entry; it declares eight
- where: packages/routing/src/index.ts:28 (DepSchema doc comment)
- scenario: the doc reads "It declares one entry, `activeTool`, because the value and the action that requires it (`tool.offhand`) are both routing's", but the interface below declares `toolOptionValues`, `menuHost`, `dispatchTrace`, `ruleCtx`, `keymaps`, `selectionSnapshot` and `modeDefaultTool` too. A reader adding a dep plans against the stated rule ("routing declares only what routing owns") and against a schema that isn't there.
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
