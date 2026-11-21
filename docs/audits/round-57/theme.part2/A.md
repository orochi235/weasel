I couldn't write `.skulkr/out/findings.md` because the write needed a permission that wasn't granted. The whole findings document is below.

## `tree-indent` hook lists a fallback no Tree read carries
- where: packages/theme/src/hooks/controls.ts:148 (CONTROL_HOOKS, `tree-indent`)
- scenario: The hook's `value` is `calc(var(--wzl-control-h-xs) + var(--wzl-space-2))`. hooks.ts:24 documents `value` as "the fallback every read of it carries… where `varies` is set, the commonest one". Tree reads the hook as `var(--wzl-tree-indent, var(--tree-gutter))` and `var(--wzl-tree-indent, var(--tree-mark))` (ui Tree.module.css:43,48). `--tree-mark` is 13px, or `--wzl-tree-fold-size` (16px) when branches fold by their glyphs. The gutter is the mark plus space-2, or plus space-3. No read uses `--wzl-control-h-xs`, which is 18px, 22px or 26px by density. `tokenTable` (prefs/tokens.ts:93) takes the listed value as the hook's CSS at every selection. So the prefs schema's auto/default for `tree.tree-indent`, and anything that shows the manifest default, reports 18px + gap at default density, while an unset Tree indents 13px + gap. At the densest setting (26px) the two differ by 13px. Pinning the shown "default" through `themeFromPrefs` changes the Tree's indent instead of keeping it. The value should be the twisty-plus-gap gutter that the hook's own description names ("one twisty and one gap").
- evidence: read
- severity: low

## `themePrefsValues` reads a leaf as `undefined` at a selection its token does not resolve at, where the schema fills it from the fallback
- where: packages/theme/src/prefs/pins.ts:96-100 (themePrefsValues)
- scenario: A root theme declares a token under only one axis value, e.g. pins `{ foo: { by: 'mode', dark: '4px' } }`. This is legal per theme.ts:10-11. `tokenTable` then gives the row a `css` holding only the `mode=dark` key.
  - `tokenLeaf` in `themePrefsSchema` (schema.ts:44-45) folds with `getOwn(row.css, key) ?? fallback`, so the leaf's auto value is `4px` in every mode.
  - The guard in `themePrefsValues` checks only `Object.values(resolved)`. That skips the missing key, so the guard passes.
  - It then folds with `prefOfCss(leaf, getOwn(resolved, key))`, with no fallback. The scope it writes holds `undefined` for `light`.
  - At `mode=light`, `value` is `undefined` and overwrites the store's value (the leaf's default) in `values`.
  
  So a form fed `themePrefsValues` in light mode shows the leaf empty, where the store and the schema both say `4px`. The two functions answer the same question two ways: what a token reads at a selection where it has no value.
- evidence: read
- severity: low

## `useColorModePreference` keeps the old storage's choice when `storage` changes under the same key
- where: packages/theme/src/useColorMode.ts:59-64 (useColorModePreference)
- scenario: The hook re-reads only when `storageKey` changes (`state.key !== storageKey`). Suppose a caller swaps `storage` and keeps the same `storageKey`, e.g. moving from a session store to `localStorage`. The hook keeps showing the preference read from the first store, while `setPreference` (deps `[storageKey, storage]`) now writes to the second. The preference shown and the one remembered disagree until the next write.
- evidence: read
- severity: low

## Files read
packages/theme/src/hooks/controls.ts
packages/theme/src/hooks/frame.ts
packages/theme/src/hooks/panels.ts
packages/theme/src/index.ts
packages/theme/src/inherited.module.css
packages/theme/src/numeric.module.css
packages/theme/src/panel.ts
packages/theme/src/pbt.fixture.ts
packages/theme/src/prefs.ts
packages/theme/src/prefs/leaf.ts
packages/theme/src/prefs/pins.ts
packages/theme/src/prefs/schema.ts
packages/theme/src/prefs/tokens.ts
packages/theme/src/react.tsx
packages/theme/src/resolveTheme.ts
packages/theme/src/sizer.module.css
packages/theme/src/store.ts
packages/theme/src/testing/computedColor.ts
packages/theme/src/testing/themeGate.ts
packages/theme/src/theme.ts
packages/theme/src/themeSheet.ts
packages/theme/src/themes/platinum.ts
packages/theme/src/themes/win9x.ts
packages/theme/src/tokenGroup.ts
packages/theme/src/tokenPx.ts
packages/theme/src/useColorMode.ts
packages/theme/src/warnOnce.ts

<!-- done: 3 findings, files read: 27 -->