---
'@weasel-js/theme': patch
'@weasel-js/hud': patch
'@weasel-js/labkit': patch
---

Themes are now authored as layered definitions and built by an engine, published as `@weasel-js/theme/engine`: seeds, generated ramps and scales, semantic rules (a step, an offset from another semantic, the first step that clears a contrast target, a reference), components and pins, any of which can vary by axis. `derive` produces a theme's tokens for one selection with provenance and validation issues, and `bake` folds every selection into a runtime `Theme`. weasel's own theme is `themes/weasel.json`, every value pinned, and emits the same CSS declarations as before. `toDTCG` in `@weasel-js/theme/engine` writes a theme back out as a DTCG document. labkit's interstellar theme is now `interstellar.theme.json`.

**Breaking.** A theme varies by *axes* rather than modes, and `mode` is one axis:

- `resolveTheme(theme, selection?)` and `applyTheme(el, theme, selection?)` take `{ mode: 'light' }` instead of `'light'`; a missing axis takes its default. `applyTheme` stamps one `data-wzl-<axis>` attribute per axis.
- `<ThemeProvider selection={{ mode }}>` replaces `mode`, and `useTheme()` returns `selection` instead of `mode`.
- `Theme` holds `axes` and `tokens` (each token plain or `{ by: 'mode', dark, light }`) instead of `defaultMode`, `tokens` and `modes`. Read an axis default with `themeAxes(theme).mode.default`.
- `defineTheme` takes `{ name, extends?, axes?, pins }`, where a pin is a value or `{ value, type, alpha, description }` and references are written `{token}` (not `{color.token}`). It throws on a definition with rules; bake those with the engine.
- `THEMES.<name>.modes.<mode>` is now `THEMES.<name>.selections['mode=<mode>']`. `THEME_SOURCES` holds definitions, `BAKED_THEMES` is new, and `TokenInput` and `ThemeSource` are removed.
- `GeneratedTheme.defaultMode` is replaced by `axes`.
- `tokens.css`'s `:root` declarations and `TOKEN_MANIFEST`'s rows are in layer order — ramps, scales, semantics, components, then other pins. The values are unchanged, but token browsers list them in the new order.
