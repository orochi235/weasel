# Audit round 53 — area `prefs` — findings

## A values source with `over` reads an alias row's target but its reset never reaches it
- where: packages/prefs/src/sources/valuesSource.ts:42,73 (createValuesSource: `leafAt` vs `reset`)
- scenario: a layout form (`CODE = { grid: alias('view.grid') }`) drawn over `SETTINGS` through `createValuesSource(CODE, …, { over: SETTINGS })` (ui's `usePrefsSource` passes `over`). The alias row's path is the target `view.grid` (ui `prefRenderContext` uses `at ?? own`). `valueAt('view.grid')` finds the leaf through `over`, so `sourceLeafIsAtReset` says "not at reset" once the value differs from `true`, and the row shows an enabled reset. Clicking it calls `source.reset(['view.grid'])` → `sourceResetPlan` → `resetPlans(source.schema, …)` → `prefNodeAt(CODE, 'view.grid')` is `undefined` → empty plan: neither `onReset` nor `set` is called, and the row stays where it was. Reads resolve a path against `schema ?? over`; resets resolve it against `schema` alone. The reset should look the leaf up the way `leafAt` does.
- evidence: read (valuesSource.ts 42 vs 73–76; policy.ts 14–16; autoReset.ts 136–166; ui Prefs/PrefsRow.tsx 130–140, Prefs/reset.tsx 15–16)
- severity: medium

## Writing `undefined` to a split pref wipes every option's value and ignores `at`
- where: packages/prefs/src/storeWrites.ts:77-80 (prefWrites → set)
- scenario: a clearable enum (or any leaf whose cleared value is `undefined`) with `scopes: [{ selector: 'look.mode' }]` holds `{ $by: 'look.mode', $in: { dark: 'a', light: 'b' } }`. `store.set(path, undefined, { at: { 'look.mode': 'light' } })` — clearing it for `light` only, as a form's `onChangeAt` does — takes the `stored === undefined || !split` branch before `write.at` is read, and `cache.set(path, undefined)` deletes the whole record: `dark` loses `'a'` too. The same happens without `at`: clearing under the current option clears every option. The `at` option is silently dropped on this one path; the undefined value should be written into the member `under` names like any other value (or only that member cleared).
- evidence: read
- severity: medium

## An auto-capable enum is accepted as a selector, and while it is auto with no `auto.value` every split read and write runs under the option "undefined"
- where: packages/prefs/src/splitCheck.ts:17-25 (refusal); packages/prefs/src/snapshot.ts:99-101,116 (build); packages/prefs/src/css.ts:161 (prefsCssAttributes)
- scenario: `look.mode` is `{ kind: 'enum', options: [dark, light], auto: { on: true } }` (or `auto: {}` then `setAuto('look.mode', true)`), and `gap` has `scopes: [{ selector: 'look.mode' }]`. `refusal` checks `encoding`, `clearable` and being split, not `auto`, so no warning. While auto, `held.get('look.mode')` is `autoHeld` = `undefined`, so `selection['look.mode'] = undefined`, `selectionWeights` gives `{ 'look.mode': { undefined: 1 } }`, and `gap` reads the member for option `"undefined"` (absent/shared) instead of any real mode; `store.set('gap', v)` writes under `{ 'look.mode': undefined }`; `prefsCssAttributes` sets `data-look-mode="undefined"`, matching none of `prefsCss`'s blocks. A selector that can hold no option is the same hazard `clearable` is refused for; `refusal` should refuse it (or warn) too.
- evidence: read
- severity: medium

## `unitScopedPrefUnit` recovers the scale by subtracting two `toRoot` results, losing it where a scope has a large offset
- where: packages/prefs/src/scopedUnit.ts:22-23 (unitScopedPrefUnit)
- scenario: `k = toRoot(1, scopes) - toRoot(0, scopes)` is a difference of two numbers of the size of the composed offset `c`. With a scope whose `scale` entry has an offset of 1e9 and a factor of 1e-9 (or any |c| ≫ k), `toRoot(1) - toRoot(0)` rounds to 0 or to a few ulps of `c`, so the unit's `scale` is 0 or badly off: displayed values divide by ~0 and typed text converts wrong. The factor should be composed directly as the product of each scope's `factor` (what `toRoot` multiplies by), not differenced.
- evidence: read (quantity/src/scope.ts 30–37)
- severity: low

## `createDefaultsSource` reads every leaf at `default`, where a store holding nothing reads a leaf that starts auto at its `auto.value`
- where: packages/prefs/src/defaultsSource.ts:17-21 (createDefaultsSource); compare packages/prefs/src/snapshot.ts:99-102 (build)
- scenario: a theme-token schema whose leaves say `auto: { on: true, value }` (the shape `docs/unruled.md` gives theme tokens), e.g. `accent: { kind: 'color', default: '#000000', auto: { on: true, value: '#3366ff' } }`. A fresh or fully reset prefs store reads `accent` as `'#3366ff'` (`prefStartsAuto` → `autoHeld`), so `prefsCss(store)` writes `--accent: #3366ff`. `prefsCss(createDefaultsSource(schema))` — what the Vite plugin serves as the build-time sheet — writes `--accent: #000000`, because `held` takes `leaf.default`/`defaultScope` for every leaf. The function's own doc says it reads "the way a store at defaults reads them"; the first paint from the served sheet and the first paint from a mounted store disagree for every auto-starting leaf, including a selector that starts auto (whose `own` option then differs too).
- evidence: read
- severity: low

## A write at one option of a split leaf that is auto rebuilds from `defaultScope`, not from the `auto.value` the other options were reading
- where: packages/prefs/src/storeWrites.ts:82 (prefWrites → set, `had`)
- scenario: `token` has `scopes: [{ selector: 'look.mode' }]`, `auto: { on: true, value: { $by: 'look.mode', $in: { dark: '#111111', light: '#eeeeee' } } }` and `default: '#000000'`. Nothing is stored, so both modes read the auto value. `store.set('token', '#222222', { at: { 'look.mode': 'dark' } })`: the leaf is unset (or holds an auto mark), so `had = unsetScope(leaf)` — the `defaultScope`, here none, so `default` — and the stored scope becomes `{ dark: '#222222' }` over the shared default: `light` jumps from `#eeeeee` to `#000000`, though only `dark` was written. `setAuto(path, false)` pins what the leaf reads now (`now.held`), so the two ways of pinning a split auto leaf leave its other options at different values; the write should start from the held auto value.
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

<!-- done: 6 findings, files read: 37 -->

