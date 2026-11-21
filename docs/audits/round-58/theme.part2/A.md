# Audit round 58 — theme.part2

Note: commit b400d7039e8ac2f03166b3332ac613eba61c689f is not in this repository (`git cat-file` fails). The checkout's
HEAD is a22801b42b, and `hooks/controls.ts`, `hooks/frame.ts`, `hooks/panels.ts`, `store.ts` and `themeSheet.ts`
have uncommitted edits (round 56's fixes). Line numbers are against the tree on disk.

## themePrefsValues splits a token's value along an axis where the schema's own leaf holds one value, and shows it as undefined at the selections the token is missing from
- where: packages/theme/src/prefs/pins.ts:96-100 (themePrefsValues)
- scenario: A token resolves at only some selections when a `{ by, … }` leaves a value out and nothing in the chain supplies it (chainTokens.ts:43-44 sets nothing when `pick` misses). Take `defineTheme({ name: 'x', pins: { foo: { by: 'mode', dark: '#000000' } } })`: `row.css` for `foo` has only the `mode=dark,…` keys. `tokenLeaf` (prefs/schema.ts:44-45) fills each missing selection with `fallback`, so the leaf's `auto.value` and `default` are the plain `#000000`. `themePrefsValues` checks only the values present (line 96) and then folds with no fallback, so `prefOfCss(leaf, undefined)` gives `undefined` at light. The result is a scope `{ $by: 'axis.mode', $in: { dark: '#000000', light: undefined } }` set into `scopes`, and with the store at `mode=light` the leaf's value is `undefined`. The form then shows a split, half-empty value for a leaf the schema calls one plain color, which is the same question answered two ways. It should fall back the way `tokenLeaf` does: the default selection's CSS, else the first.
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

<!-- done: 1 findings, files read: 27 -->
