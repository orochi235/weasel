# @weasel-js/labkit

## 1.0.2

### Patch Changes

- f322c78: `@weasel-js/labkit/styles.css` now carries styles for the components labkit
  passes through. It previously held only labkit's own `.lk-*` chrome, so anything
  reached via `@weasel-js/labkit/weasel-ui` arrived with class names matching no
  rule — a `Slider` rendered as a zero-height track with unpositioned thumbs — and
  nothing errored anywhere. The import path is unchanged; a consumer already
  importing it gets the fix by upgrading.

  The stylesheet is now three layers: `@weasel-js/theme` tokens (the `--wzl-*`
  custom properties weasel-ui's rules read), weasel-ui's compiled CSS modules, then
  labkit's chrome last so it overrides what it wraps. Layer two is taken from the
  same `@weasel-js/ui` build tsup bundles the JS out of, since CSS-module class
  names are minted per build and the two have to match.

  The consumer smoke test holds this: every scoped class name in the shipped
  bundle must have its module's rules present in the shipped stylesheet.

  - @weasel-js/theme@1.0.2

## 1.0.1

### Patch Changes

- 75e15ca: `useRovingTabIndex` — the arrow-key focus behavior `ActionsBar`, `OptionsBar`,
  and `ToggleBar` each implemented separately, now one hook they share (and one
  `@weasel-js/ui` exports, re-exported through `@weasel-js/labkit/weasel-ui`).
  It handles the tab stop, arrow/Home/End navigation with disabled items skipped
  and wrap-around at both ends, and optional selection-follows-focus for
  radiogroup-style bars. Its docs say when a bar should _not_ use it: a
  container of arbitrary compound controls has to leave the arrow keys to those
  controls, which is why `ToolOptionsBar` still doesn't have one.

  No keyboard behavior changed in any of the three bars.

  - @weasel-js/theme@1.0.1

## 1.0.0

### Major Changes

- 5debfac: labkit's theming collapses into the shared system.

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

### Patch Changes

- Updated dependencies [5debfac]
- Updated dependencies [6855465]
  - @weasel-js/theme@1.0.0

## 0.8.0

### Patch Changes

- 0d5cdc4: Design tokens are generated from a DTCG source.

  `packages/theme/tokens/` is now the only hand-edited token artifact. One
  generator emits `tokens.css`, the TS theme objects, the `TokenName` union, and
  the Storybook token manifest, replacing a hand-written stylesheet, a
  hand-mirrored `DEFAULT_TOKENS` object, and two separate regex parsers that each
  re-derived the token list from CSS on disk. A determinism test fails if the
  committed output drifts from the source.

  The `color-mix()` tokens (`--wzl-line*`, the button hover/pressed fills) are now
  computed exactly on the JS side instead of being, per the old file's own header,
  "plausible hex approximations". CSS output still emits `color-mix()` so a
  downstream override of the referenced token keeps tinting.

  Modes are selected with `data-wzl-mode` (was `data-theme`), and are declared
  per-theme in the DTCG source rather than as hand-restated selector blocks.

  Oswald and Inter now ship with the package under OFL 1.1 and load via a new
  opt-in `@weasel-js/theme/fonts.css` entry; `tokens.css` no longer `@import`s a
  stylesheet from `fonts.googleapis.com`. labkit consumes the same font files
  instead of its own copy — which it had been publishing with no license file,
  no `OFL.txt`, and no attribution — and gains the `LICENSE` it was missing. Its
  `@font-face` also no longer declares a `100 900` weight axis; Oswald's real
  range is `200 700`.

## 0.7.2

### Patch Changes

- 8bc719a: Every package now declares `engines.node: ">=22"`, up from `">=20"`. Node 20
  reached end of life on 2026-04-30, so the old floor advertised support for a
  runtime that no longer receives security patches — a claim in each published
  tarball that had quietly stopped being true. `@weasel-js/labkit` had no `engines`
  field at all and now matches its siblings.

  Nothing in the kit required a Node 20 feature, so this changes what is promised
  rather than what runs. CI tests both ends of the range: the 22 floor and the 24
  Active LTS the release and docs workflows build on.

## 0.7.1

## 0.1.0

### Minor Changes

- ec64b15: First public release of @weasel-js/labkit — React widgets for building self-contained interactive lab pages (primitives, controls, layers, drag-and-drop, property panels, undo, canvas helpers). Ships as a self-contained bundle with no `@weasel-js/*` runtime dependencies.
