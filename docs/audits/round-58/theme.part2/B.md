I couldn't write `.skulkr/out/findings.md` because the write permission was denied. Following the brief's fallback, here is the whole document.

# Audit round 58 — theme.part2

## A dimension token whose value is a bare `0` gets a unitless number leaf, so editing it pins an invalid length
- where: packages/theme/src/prefs/leaf.ts:24-28 (tokenLeafKind), with cssOfPref at :46-47
- scenario: `readCssNumber('0')` returns `{ value: 0, unit: '' }` (cssNumber.ts). So a `dimension` token that is `0` at every selection becomes `{ kind: 'number' }` with no unit. That covers `titlebar-inset`, `titlebar-label-pad`, `tree-leaf-indent`, `panel-title-inset`, `stance-clarify-border-width`, `stance-preview-pad` and `tracking-none`. If a user sets one to 4 in the theme prefs form, `cssOfPref` writes `4` and `themeFromPrefs` pins `--wzl-titlebar-inset: 4`. A rule like `padding: var(--wzl-titlebar-inset)` or `letter-spacing: 4` is then invalid when the value is computed. The property falls back to its initial value (0 or normal), so the edit visibly does nothing. It should treat a unitless `0` of a length type as px, as `tokenPx` already does for `0`, or give a `dimension` number leaf a unit.
- evidence: read
- severity: medium

## A token a theme sets at only some axis values shows another selection's value at the rest
- where: packages/theme/src/prefs/tokens.ts:74-95 (tokenTable) and packages/theme/src/prefs/schema.ts:44-45 (tokenLeaf)
- scenario: take `defineTheme({ name: 't', pins: { 'bevel-raised': { by: 'mode', light: '…' } } })`, a hook set for light only.
  - At `mode=dark`, `resolveTheme` has no `--wzl-bevel-raised`. A `by` that leaves a value out contributes nothing (chainTokens.ts `tokenAt` and `pick`), and no theme in the chain declares the hook.
  - So the row's `css` holds only the light key. The branch for hooks the theme leaves alone (:91-95) skips it, because the name is already in `names`.
  - `tokenLeaf` then takes `fallback = getOwn(css, defaultKey) ?? Object.values(css)[0]`, which is the light value, and uses it at every missing selection.
  - The schema's `auto.value` and default therefore say dark draws the light bevel, while the page actually draws the hook's fallback (`none`). Saving a touched form pins the light bevel into dark.
  - A token missing at a selection should read there as the hook's manifest `defaultValue`, as an untouched hook already does.
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

<!-- done: 2 findings, files read: 27 -->