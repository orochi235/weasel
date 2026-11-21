# Audit round 65 — area `prefs`

## prefsCss writes its root block at each selector's `default`, while a store at defaults (and `createDefaultsSource`) reads a selector that starts auto at its `auto.value`
- where: packages/prefs/src/css.ts:118 (prefsCss, `defaults`)
- scenario: a selector enum `theme` with options `light`/`dark`, `default: 'light'`, `auto: { on: true, value: 'dark' }` (allowed: `refusal` in splitCheck.ts only refuses an auto selector whose auto value is no option), and a leaf `look.bg` scoped by `theme`. With nothing stored, the store's snapshot (`unsetHeldOf` → `autoHeldOf`) sets the selection to `theme=dark`, and `createDefaultsSource` builds its own selection the same way (defaultsSource.ts:17-18, whose doc says it reads "the way a store at defaults reads them"). `prefsCss` then overrides that with `at: { theme: leaf.default }` = `light`, so the unattributed root block declares `--look-bg` as the light member. The `weaselPrefsCss` Vite sheet (no attributes set) therefore styles the page with the `light` member while the app's store at defaults reads `dark`, and `prefsCssAttributes` on the same store reports `data-theme="dark"`. Should: build `defaults` from the selection the source itself reads (e.g. `store.get(path)` per selector, or from `unsetHeldOf`), one answer for "which option a selector is at by default".
- evidence: read
- severity: medium

## A stored split value whose scope names a selector the schema no longer has reads as the plain `default`, not the leaf's `defaultScope`, and an `auto.value` scope does the same
- where: packages/prefs/src/snapshot.ts:53 (readStored)
- scenario: leaf `gap` (number, `default: 4`, `scopes: [{ selector: 'mode' }]`, `defaultScope: { $by: 'mode', $in: { dark: 8 } }`). An older build stored `gap` as `{ $by: 'theme', $in: { … } }`, and `theme` has since been removed from the schema. `repairScope` returns `undefined` (split by a selector not in `known`), so `readStored` returns `leaf.default` = 4 under every `mode`, though the record is unreadable and the leaf with nothing stored reads 8 under `mode=dark` (`pinnedUnsetHeld`). `isSet` also reports it set. The same fallback runs in `autoHeldOf` (snapshot.ts:74) for an `auto.value` given as a scope, so an auto leaf reads its `default`, which `prefAutoValue`'s contract says it never does. Should: fall back to what the leaf reads with nothing stored (`pinnedUnsetHeld` / the declared auto read), not `leaf.default`.
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

<!-- done: 2 findings, files read: 37 -->
