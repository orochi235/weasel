I couldn't write `.skulk/out/findings.md`: the first write went through, but every later write or append was refused. The full document is below instead. The brief's frozen commit 608f35f5 isn't in this clone, so I read the tree at HEAD 830b463cc1, which has no uncommitted changes under `packages/routing`. I also didn't get to check the last week's history of these files, because the `git log` call was refused.

# Audit round 54: routing (blind reviewer)

## The settings submenu triggers the action without the point the menu was opened at
- where: packages/routing/src/menus/resolveMenu.ts:112-115 (settingsOf, onChange), compared with :72 (itemOf)
- scenario: a canvas context menu is opened with `MenuOpenRequest.world` set, and it holds an action that has `settings`.
  - A plain item runs `trigger(id, { ...ctx.params, ...it.params, world: ctx.at })`.
  - Each edit in the settings submenu runs `trigger(id, { ...ctx.params, ...it.params, ...params })`, with no `world`.
  - `ActionsProvider`'s menu host passes params straight to `registry.trigger` (ActionsProvider.tsx:203).
  - So the same action, from the same menu, gets the opened-at point on one path and nothing on the other. An action that reads `params.world` acts in the wrong place, or refuses, only when changed through its settings rows.
  - The row's `checkEnabled` was judged with `world` in params, so the row shows enabled under conditions the run doesn't get.
- evidence: read (resolveMenu.ts:72, 112-115; ActionsProvider.tsx:199-205)
- severity: medium

## dlog: `*` inside a namespace list does not turn on every namespace
- where: packages/routing/src/dlog.ts:44-45, 60-64 (read, isDebugEnabled)
- scenario: with `localStorage.setItem('weasel.debug', 'tools,*')`, `read()` treats `'*'` as "all" only when it is the whole value. The list form yields `set = {tools, *}`, so `isDebugEnabled('history')` checks `set.has('history')` and returns false. The docs on `isDebugEnabled` and `dlog` say a namespace is on when it "(or `*`) is enabled".
- evidence: read
- severity: low

## A publisher that unmounts clears the selection slot even when another live publisher holds the same selection
- where: packages/routing/src/ambient/SelectionContext.tsx:121-126 (usePublishSelection unmount effect), :54-55 (publishSelection dedupe)
- scenario: canvas A publishes `[n1]`. Canvas B then selects `[n1]` too; its publish does nothing because the serialization equals `lastSerializedRef`.
  - When B unmounts, the slot's content equals B's serialization, so B calls `publishSelection([])`.
  - Readers then show an empty selection while A still has `n1` selected, and A never republishes because its serialization didn't change.
  - The "unless another publisher has written it since" check compares content, not who wrote it.
- evidence: read
- severity: low

## `siblingsOf` splits a map-key path at an escaped dot
- where: packages/routing/src/menus/valueRows.ts:18-22 (siblingsOf), with compoundRows.ts:147 (mapRows)
- scenario: take a `map` leaf whose item is a boolean or enum with an `encoding`, holding the key `"a.b"`.
  - `mapRows` draws the item at path `m.a\.b`, because `pathSegment` escapes the dot.
  - `siblingsOf` splits at `path.lastIndexOf('.')`, so it reads the parent at `m.a\` instead of `m`.
  - `below()` resolves that to `getOwn(map, 'a\\')`, which is undefined, so `encoding.read`/`write` get no siblings.
  - Every other path reader in the menus goes through `pathSegments`, which honors the escape. This one finds the parent path a second, different way.
- evidence: read
- severity: low

## A held trigger spelled in a different case is not treated as a modifier
- where: packages/routing/src/contributions/heldModifier.ts:9-16 (MODIFIER_OF, heldModifierOf)
- scenario: the `HotkeyTrigger` doc (contributions/types.ts:13-15) says a trigger is a `KeyboardEvent.key`, "matched case-insensitively as every key spec is".
  - A tool declaring `offhand: 'control'` (or `'SHIFT'`) gets `heldModifierOf(...) === null`, so `scopeBindings` does not loosen its bindings.
  - While Control is held, every binding of the engaged tool that doesn't name `ctrl` forbids it and never matches.
  - The table holds only the exact spellings (`ctrl`/`Control` and so on). The exact-case `MODIFIER_KEYS` set in `toolOffhand.ts` has the same gap.
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

<!-- done: 5 findings, files read: 34 -->