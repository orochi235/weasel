Write permission for `.skulk/out/findings.md` was denied, so the whole findings document is below.

# Audit round 54: routing

## Routing's "no React" main entry loads React through `isDev`
- where: packages/routing/src/menus/resolveMenu.ts:16 (module import), reached from packages/routing/src/index.ts:280
- scenario: `index.ts` says the main entry is "the pure half: no React, no DOM", and `react.ts` says "a kernel that drives routing itself imports only the main entry and never loads any of this". React is an optional peer of routing. But `resolveMenu.ts`, which the main entry re-exports, does `import { isDev } from '@weasel-js/react'`. That barrel loads `useLatest.ts`, which imports `useInsertionEffect` and `useRef` from `'react'`. So a host with no React installed fails to resolve `'react'` on `import '@weasel-js/routing'`. Other files the main entry pulls in do the same: `matcher.ts`, `actionEnabled.ts`, `buildDeps.ts` and `dispatchTrace.ts`. It should import `isDev` from `@weasel-js/registry`, which `@weasel-js/react` only re-exports.
- evidence: read (the import chain was traced through `packages/react/src/index.ts:4,7` and `useLatest.ts:1`; nothing was run)
- severity: medium

## A menu's settings submenu triggers its action without the `world` point
- where: packages/routing/src/menus/resolveMenu.ts:112-115 (settingsOf, onChange)
- scenario: `resolveSchemaMenu` promises that `at` "reaches `enabled` and every action's params". A plain row does that: `itemOf` builds params as `{ ...ctx.params, ...it.params, world: ctx.at }`. A settings row instead triggers with `{ ...ctx.params, ...it.params, ...params }` and leaves out `world`. Take a context menu opened on the canvas at a world point, for an action with `settings` (say "apply style at point"). Changing a field triggers the action with no `world`, while the same action run as a plain row gets one. The action then acts on the wrong target, or on none.
- evidence: read
- severity: low

## The route-conflict check never re-runs for actions registered later, or for bindings that change under the same ids
- where: packages/routing/src/contributions/useContributions.ts:175-206 (useRouteConflictReport)
- scenario: the check skips itself when its signature hasn't changed, and that signature is only the entry ids plus the binding overrides. `check` is subscribed to the actions registry, and `actionsRegistry.list()` is one of the inputs to `reportRouteConflicts`. Yet when an action registers after the first pass (a lazily mounted component calling `useAction`), the signature is the same, so `check` returns before comparing anything. The same happens when an entry's bindings change but its id doesn't: `entries` is an effect dep, so the effect re-runs, then hits the same early return. Conflicts these introduce are never reported in dev.
- evidence: read
- severity: low

## A held modifier written in a case other than the two in the table loses its loosening
- where: packages/routing/src/contributions/heldModifier.ts:9-16 (heldModifierOf)
- scenario: the `HotkeyTrigger` doc says any non-named trigger is a `KeyboardEvent.key` value, "matched case-insensitively as every key spec is". So `offhand: 'control'` or `'SHIFT'` holds correctly through `offhandKeyFor` and `matchKey`. But `MODIFIER_OF` only has the exact spellings `alt`/`Alt`, `ctrl`/`Control` and so on, so `heldModifierOf` returns `null`. `scopeBindings` then leaves the held tool's bindings strict. Because a spec with no `mods` refuses any held modifier, none of the tool's unmodified bindings match while its own trigger is down. The tool engages but does nothing. Two tables answer "which key is this trigger": `MODIFIER_OF` here and `offhandKeyFor`.
- evidence: read
- severity: low

## Map entries whose keys contain `.` read the wrong siblings for an encoded boolean or enum
- where: packages/routing/src/menus/valueRows.ts:18-22 (siblingsOf)
- scenario: `compoundRows` escapes a map key's `.` and `\` in paths (`pathSegment`, and `pathSegments` to undo it). `siblingsOf` instead splits at the raw `path.lastIndexOf('.')`. For a map entry keyed `a.b`, the path is `m.a\.b`. When the entry's item is an object holding an encoded boolean `flag`, its path is `m.a\.b.flag`, and `siblingsOf` correctly reads `m.a\.b`. But a boolean or enum that is itself the map item has the path `m.a\.b`. Its parent is cut to `m.a\`, which `below` resolves to key `a\`, so the value is `undefined`. `encoding.read` and `encoding.write` then get no siblings, and the row shows and writes the wrong value. The parent should come from `pathSegments`, not a raw split.
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