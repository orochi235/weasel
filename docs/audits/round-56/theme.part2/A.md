# Audit round 56 — theme.part2

Note: the checkout's HEAD is a22801b42b, not b8bed07d81 as the brief states; line numbers are against the tree as found.

## `tree-indent` hook records a fallback the Tree's CSS never takes
- where: packages/theme/src/hooks/controls.ts:141 (CONTROL_HOOKS, `tree-indent`)
- scenario: `TokenHook.value` is documented as "the fallback every read of it carries", and `tokenTable` (prefs/tokens.ts:93) hands it to the prefs schema as the hook's value at every selection. But `Tree.module.css:43,48` read `var(--wzl-tree-indent, var(--tree-gutter))` / `var(--tree-mark)`, where `--tree-gutter` is `13px + space-2` (or `fold-size + space-3`, or the hung-glyph max). The prefs/theme editor shows `calc(var(--wzl-control-h-xs) + var(--wzl-space-2))` as the unset value, and pinning that value it showed changes every Tree's indent instead of leaving it as is. Same shape, smaller: `tree-leading-size` lists `auto` while `Tree.module.css:25,161` read it with `16px` and `var(--wzl-tree-fold-size, 16px)`; `button-icon-size` lists `14px` while xs/sm read `12px`; `params-label-tracking` lists `--wzl-tracking-wide` while titles read `--wzl-tracking-wider`; `prop-row-h` lists a literal `20px` while every read falls back to `var(--wzl-field-h, var(--wzl-control-h))`, which follows density, so a leaf shown as `20px` and saved unchanged would pin compact and roomy rows to 20px.
- evidence: read
- severity: low

## `httpThemeApi.get('list')` returns the list endpoint's body typed as a theme
- where: packages/theme/src/store.ts:52,59 (httpThemeApi, `url`/`get`)
- scenario: `url(name)` splices the name in unescaped and unchecked. The server's route (`scripts/vite-theme-store.ts:6,18`) answers `__theme/list` with `{ themes: [...] }`, so `get('list')` resolves to that object cast as `StoredTheme` (no `definition`, no `hash`); a caller reading `.definition` gets `undefined` far from the cause. A name outside `[a-z][a-z0-9-]*` (an uppercase letter, a `#`) misses the route, falls through to the dev server's HTML fallback with 200, and `response.json()` throws a SyntaxError instead of a clear "no such theme". Should refuse names the store cannot hold, or at least `list`.
- evidence: read
- severity: low

## A second same-named theme inherits every declaration of the first that it does not restate
- where: packages/theme/src/themeSheet.ts:47,53 (`only`, `write`)
- scenario: Variant 0's rule is the bare selector, e.g. `[data-wzl-theme='app'][data-wzl-mode='dark'] { … }`, and a variant-1 element carries those same attributes plus `data-wzl-variant='1'`, so it matches both rules; the later variant rule wins only for the properties it declares. Theme A (`defineTheme({ name: 'app', pins: { 'button-h': '40px' } })`) and theme B (`defineTheme({ name: 'app', pins: { accent: '#bbbbbb' } })`) applied at once: B's elements get `--wzl-button-h: 40px` from A's bare rule, though B never set it. The same happens for a token applyTheme drops from B's body as undeclarable (applyTheme.ts:40-45: B's element shows A's value instead of the fallback) and for `color-scheme` when only A's axis value has a scheme. It also flips when A is released and a third definition C takes id 0: C's bare rule now leaks onto B's elements. `applyTheme.pbt.test.ts` checks only the element's own resolved names, so it doesn't catch this. The id-0 rule needs `:not([data-wzl-variant])` (inside `:where()` to keep specificity) so each definition's rule matches only its own elements.
- evidence: read
- severity: medium

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
