---
'@weasel-js/theme': patch
---

Stop five border and surface tokens resolving to their dark values in light mode.

`--wzl-line`, `--wzl-line-subtle`, `--wzl-line-strong`, `--wzl-surface-hover` and `--wzl-surface-pressed` are authored as an alpha of `{color.fg}`, which varies by mode. They were emitted only into `:root`, and CSS substitutes a `var()` inside a custom property at the scope where that property is *declared* — so all five resolved once against `:root`'s dark `--wzl-fg` and inherited that frozen value into the light block. Every border in light mode was drawn in the dark palette's near-white.

`build-tokens.ts` now walks each primitive's reference chain and redeclares any token that reaches a mode semantic inside every mode block as well as `:root`. The `:root` values are unchanged, so a surface with no `data-wzl-mode` set behaves exactly as before.

Only the raw `tokens.css` + `data-wzl-mode` path was affected. `applyTheme` re-emits every token as a literal into one mode-scoped rule, so labkit and anything else under `ThemeProvider` was always correct — which is why the Foundations page's own light/dark comparison, which uses the raw sheet, was the one place showing it.
