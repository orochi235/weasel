# Audit round 53, area `prefs`: findings

## A split color pref holding CSS color names or rgb()/hsl() strings is never mixed, only snapped to its heaviest member
- where: packages/prefs/src/blend.ts:36 (blendColor)
- scenario: a `color` leaf split by a selector holds `{ light: 'red', dark: 'blue' }` (the repair keeps any CSS color `tryParseColor` reads, per docs/unruled.md round 23, and labkit defaults to names like `'red'`); a read under `weights: { theme: { light: 0.5, dark: 0.5 } }` calls `hexToRgba('red')`, which only parses hex and throws, so the catch returns the heaviest member, `'red'`, instead of the 50/50 mix. Same for `'rgb(…)'`, `'hsl(…)'`, `'oklch(…)'`. Mixing should parse with `parseColor`/`tryParseColor`, the reader the leaf's repair uses.
- evidence: read (packages/paint/src/color.ts:126 `hexToRgba` → `normalizeHex` → `parseHexBytes`)
- severity: medium

## `createDefaultsSource` reads a leaf that starts auto at its `default`, where a store with nothing stored reads its `auto.value`
- where: packages/prefs/src/defaultsSource.ts:17 (createDefaultsSource)
- scenario: a leaf declares `default: 4, auto: { on: true, value: 8 }` (the shape theme tokens use, per docs/unruled.md "Auto and reset"). A fresh store's `get`/`values()` read 8 (snapshot.ts:99 `prefStartsAuto` → `autoHeld`), and `prefsCss(store)` writes `--x: 8`. `prefsCss(createDefaultsSource(schema))`, the build-time stylesheet the doc says reads "the way a store at defaults reads them", writes `--x: 4`; a split `auto.value` (a `PrefScope`) is likewise ignored in favor of `defaultScope`. So the build-time sheet and the runtime sheet disagree for every auto-starting leaf. It should read `prefResetOf(leaf).value` (repaired) the way the snapshot does.
- evidence: read (snapshot.ts:81-102 vs defaultsSource.ts:17-20)
- severity: medium

## A values source's reset ignores `over`, so an alias row's Reset into another schema writes nothing
- where: packages/prefs/src/sources/valuesSource.ts:73 (createValuesSource, `reset`); packages/prefs/src/sources/policy.ts:14 (sourceResetPlan)
- scenario: a layout schema `CODE = { grid: alias of 'view.grid' }` drawn over `SETTINGS` (as `testing/editAssetSet.ts` sets up), `createValuesSource(CODE, get, set, { over: SETTINGS })`, `view.grid` held at `false` (default `true`). `valueAt('view.grid')` finds the leaf through `leafAt`'s `over` fallback, so `sourceLeafIsAtReset` is false and ui's `rowReset` (packages/ui/src/components/Prefs/PrefsRow.tsx:140, called with the alias's target path) shows the Reset control. Clicking it calls `source.reset(['view.grid'])` → `resetPlans(source.schema = CODE, …)` → `prefNodeAt(CODE, 'view.grid')` is `undefined` → empty plan: neither `onReset` nor `set` is called and the value stays `false`. The reading and the reset answer "which leaf is at this path" two ways; the plan should find the leaf in `over` as `leafAt` does.
- evidence: read (valuesSource.ts:42 vs :74, autoReset.ts:157-166)
- severity: medium

## A selector enum that opts into `auto` is accepted, and while auto with no `auto.value` the store's selection holds `undefined`
- where: packages/prefs/src/splitCheck.ts:17 (refusal); packages/prefs/src/snapshot.ts:116 (build, `selection`); packages/prefs/src/css.ts:161 (prefsCssAttributes)
- scenario: `mode: enum ['light','dark'], default 'light', auto: { on: true }` (a theme mode following the OS) and `ink: color, scopes: [{ selector: 'mode' }]`. `refusal` rejects a clearable enum because it "may hold none of its options", but lets this one through, and a store with nothing stored reads `mode` as `undefined` (autoReset.ts:22, ruled in docs/unruled.md). So `selection.mode` is `undefined`, `weightsUnder` builds `{ mode: { undefined: 1 } }`, `ink` reads its shared member rather than either option's, `store.get('ink', { at: {} })` and `values()` follow suit, and `prefsCssAttributes` hands `claimAttributes` `undefined`, which `setAttribute` writes as `data-mode="undefined"`, matching no block. `checkPrefScopes` warns of nothing. Either refuse an auto-capable selector (as clearable is) or read a selector's auto with no value as its default.
- evidence: read
- severity: medium

## A store from `usePrefsStore` still persists and notifies after `close`, against the store's own contract
- where: packages/prefs/src/usePrefsStore.ts:40 (lent); packages/prefs/src/store.ts:76 (`closed` contract)
- scenario: two components use `usePrefsStore(A, opts)` and `usePrefsStore(B, opts)` on one storage and prefix. The A component unmounts; `closeUnheldSoon` closes A's store, whose cache is `lent`, so `close` only flushes and the shared cache stays open for B. A callback still holding A's store (an async handler, an effect cleanup) then calls `storeA.set('x', 1)`: it warns "will not persist", yet `cache.set` lands in the open shared cache, is written to storage, and B's store hears it. `PrefsStore.closed` says such a write "reaches neither storage nor its subscribers". The lent cache, or the store, needs to drop writes after close.
- evidence: read
- severity: low

## Pinning a split leaf that is auto with a plain `auto.value` pins it only under the current selection
- where: packages/prefs/src/store.ts:182 (setAuto); packages/prefs/src/storeWrites.ts:82 (set)
- scenario: `ink: color, default '#000', scopes: [{ selector: 'mode' }], defaultScope { light '#000', dark '#fff' }, auto: { value: '#888' }`, marked auto. Every option reads `#888`. `setAuto('ink', false)` calls `writes.set('ink', '#888')`; the record is an auto mark, so `had` is the split default and `writeDeclared` writes `#888` only into the option `mode` is on now. Switching `mode` to `dark` then reads `#fff`, a value the leaf did not read while auto, though `setAuto(false)` is documented as "pin it at the value it reads now". Pinning should write the auto value for every option (store it whole) where `auto.value` is not a scope.
- evidence: read
- severity: low

## `prefsCss` writes an enum option that is a CSS-wide keyword bare, so the property takes the keyword's meaning
- where: packages/prefs/src/css.ts:58 (cssValue, `enum`)
- scenario: an enum leaf with options `'inherit' | 'left' | 'right'` (or `'initial'`, `'unset'`, `'revert'`, `'revert-layer'`), set to `inherit`. `IDENT` matches, so the sheet reads `--align: inherit;`, which makes the custom property inherit its parent's value (and `initial` makes it guaranteed-invalid, so `var(--align, …)` falls back) instead of holding the ident `inherit`. These keywords should be quoted like any other text that is not a plain value.
- evidence: read
- severity: low

## `prefNodeAt` finds a nested section by its key, though a section's key is no path segment, and `resetPlans` then builds paths no leaf has
- where: packages/prefs/src/autoReset.ts:143 (prefNodeAt) with :70 (prefResets)
- scenario: a `PrefSection` root `{ members: { look: { members: { size: number } } } }`, whose one leaf's path is `size`. `prefNodeAt(root, 'look')` returns the inner section via `Object.hasOwn(root.members, 'look')`, contradicting its doc ("nothing for a section's key"), and `resetPlans(root, ['look'], read)` calls `prefResets(section, 'look')`, which joins leaf keys onto it and reads/writes `look.size`, a path no reader holds. It should match only leaf members by key (as `prefLeafAt` does) or pass the section the path its members are relative to.
- evidence: read
- severity: low

## Files read
packages/prefs/src/KitSettingsFromPrefs.tsx
packages/prefs/src/aliasTargets.ts
packages/prefs/src/autoReset.ts
packages/prefs/src/blend.ts
packages/prefs/src/conditionCheck.ts
packages/prefs/src/css.ts
packages/prefs/src/defaultsSource.ts
packages/prefs/src/edit.entry.ts
packages/prefs/src/heading.ts
packages/prefs/src/hooks.ts
packages/prefs/src/hostAttributes.ts
packages/prefs/src/index.ts
packages/prefs/src/kinds.ts
packages/prefs/src/kitCss.ts
packages/prefs/src/merge.ts
packages/prefs/src/migrate.ts
packages/prefs/src/open.ts
packages/prefs/src/order.ts
packages/prefs/src/pair.ts
packages/prefs/src/react.ts
packages/prefs/src/scopedUnit.ts
packages/prefs/src/snapshot.ts
packages/prefs/src/sources/policy.ts
packages/prefs/src/sources/prefsSource.ts
packages/prefs/src/sources/selectionSource.ts
packages/prefs/src/sources/valuesSource.ts
packages/prefs/src/splitCheck.ts
packages/prefs/src/stamp.ts
packages/prefs/src/store.ts
packages/prefs/src/storeWrites.ts
packages/prefs/src/tabRuns.ts
packages/prefs/src/tags.ts
packages/prefs/src/testing/editAssetSet.ts
packages/prefs/src/type.ts
packages/prefs/src/usePrefsStore.ts
packages/prefs/src/vite.ts
packages/prefs/src/weightAxes.ts

<!-- done: 8 findings, files read: 37 -->
