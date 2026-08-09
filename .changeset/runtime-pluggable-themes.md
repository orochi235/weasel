---
"@weasel-js/theme": minor
"@weasel-js/hud": minor
"@weasel-js/ui": patch
---

Themes are values you can define, extend, and apply.

`defineTheme` / `resolveTheme` / `applyTheme` / `loadDTCG`, plus a React
binding at `@weasel-js/theme/react`. A theme extends the built-in one by
default, so a partial theme can't be incomplete; overriding a primitive
rebases every alias that references it. `applyTheme` stamps data attributes
and adopts a rule block rather than writing inline properties, so the cascade
still does the work and per-subtree overrides are just a different theme name.

The WebGL HUD no longer reads CSS custom properties through
`getComputedStyle`. It receives the same resolved record the stylesheet was
built from, which also makes headless rendering themeable for the first time.
`readTokens` and `ResolvedTokens` are gone from `@weasel-js/hud`; use
`ResolvedTheme` and pass a theme to `attach`.

The sixteen deprecated `--wzl-*` aliases are removed (264 call sites migrated).
Three were never aliases and became real semantics: `--wzl-fg-inverse`,
`--wzl-surface-hover`, `--wzl-surface-pressed`.
