---
"@weasel-js/labkit": major
"@weasel-js/theme": minor
---

labkit's theming collapses into the shared system.

**Breaking.** `@weasel-js/labkit/theme-light.css` and
`/theme-interstellar.css` are gone, and so are the 42 `--lk-*` custom
properties — component styles read `--wzl-*` now. `<Lab>` and `<LabShell>`
take `mode` (`"auto" | "light" | "dark"`) instead of `theme`
(`"auto" | "light" | "interstellar"`); a stored `"interstellar"` preference
hydrates as `"dark"`. `LabTheme` is now `LabMode`, and the store's `setTheme`
is `setMode`.

`interstellar` is exported as a `Theme` value — authored as a DTCG document,
loaded through `loadDTCG`, extending the built-in theme. It overrides values
only: labkit's font weights, radius and glass blur differ from weasel's, and
`extends` rebases everything else.

Fixes three sets of references that had no definition and silently fell back
to hardcoded light-mode values or to nothing, which is why `LayerList`,
`Palette`, `DragGhost`, `ControlPanel` and `CanvasStack` did not follow the
theme.

`@weasel-js/theme` gains the token groups labkit contributed: a four-step
spacing scale, three z-layer constants, a ten-color categorical swatch set,
`--wzl-backdrop`, `--wzl-control-h`, `--wzl-glass-blur`, `--wzl-radius-lg`,
`--wzl-font-size`, `--wzl-font-size-sm` and `--wzl-font-weight-medium`.
`ThemeProvider` accepts `className` and `style`, so its wrapper can be the
consumer's own layout element instead of an extra div inside it.
