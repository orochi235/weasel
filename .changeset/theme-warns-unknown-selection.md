---
'@weasel-js/theme': minor
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

`applyTheme` and `<ThemeProvider>` warn in development of a selection axis or axis value the theme does not declare.

`{ mdoe: 'dark' }` now warns once per theme and axis. Where one selection is shared across themes on purpose, pass `ignoreUnknownAxes: true` to `applyTheme` (or `<ThemeProvider ignoreUnknownAxes>`), or narrow it first with the new `declaredAxisChoice(theme, selection)`, which `<Lab>` and forge's capture view now do.

<!-- entry: fix api -->
