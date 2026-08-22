# @weasel-js/labkit

## 1.1.0

### Patch Changes

- e2a2013: A drawing instrument can show a readout, and its layers can follow the camera

  Three gaps that together made a canvas instrument hard to build.

  **`render` is an overlay, not an alternative.** `Workspace` rendered the canvas
  _or_ the instrument's DOM, so anything that drew lost the ability to put numbers
  beside its drawing — for a measuring instrument, most of the point. The
  workaround was painting the readout onto a layer as text, giving up selection,
  theming, wrapping and layout. `instrument.render(ctx)` is now passed to
  `CanvasStack` as children and lands in `.lk-canvas-stack__overlay`. An
  instrument returning `null` behaves exactly as before.

  **Layers now draw in world coordinates.** The instrument-level adapter passed
  `zoom` but dropped `pan`, so panning was inert for every instrument-declared
  layer: the gesture moved the view, the layer redrew, and nothing moved. A layer
  could not implement panning itself either, because the value never arrived.
  `Workspace` now applies the camera to the context before calling `draw`, so a
  layer places world geometry directly. `zoom` is still in the args for what must
  not scale — `ctx.lineWidth = 1 / zoom`. **A layer that already mapped
  coordinates by hand will now double-apply and must drop its own mapping.** The
  lower-level `CanvasLayerDescriptor.render(ctx, view)` is unchanged and still
  gets an untransformed context, which is what screen-space chrome wants.

  **Typed instruments no longer need a cast.** `defineInstrument<TS, TC>` returns
  `Instrument<TS, TC>`, which parameter contravariance kept out of
  `LabProps.instruments`, so every consumer wrote `as unknown as Instrument` at
  the point the types were supposed to pay off. The prop is now `InstrumentList`
  (`readonly Instrument<any, any>[]`), newly exported; the `any` is contained to
  that alias.

- 3cfb1b4: `<Lab>` sizes itself correctly on a page that has not been reset for it

  `.lk-lab` is `height: 100%`, which resolves against its containing block, so
  the component only filled the window when the host had already given every
  ancestor a height and zeroed the body margin. Every example in this repo
  hand-writes `html, body, #root { margin: 0; height: 100% }` to make that true,
  and a consumer who supplies the height but not the margin reset got a page
  taller than the viewport — one wheel notch of scroll, which reads as a stuck
  canvas rather than as overflow. Supplying neither collapsed the lab to zero
  height and rendered a blank page.

  `styles.css` now carries the reset the component's own sizing assumes, scoped
  with `:has` so a page that mounts no lab is untouched. It reaches the lab's
  own parent and stops there, so a lab embedded in a sized box still fills that
  box and cannot resize its host's layout.

- 11efb43: Rename a lab's tile from workspace to trial, and the area they sit in to workspace.

  `Workspace` named two different things: one tile, and the grid the tiles were
  laid out in. A tile is now a **trial** — `<Trial>`, `TrialRecord`,
  `TrialChrome`, `TrialIdProvider` / `useTrialId`, `addTrial` /
  `updateTrialState` / … — and the grid takes the freed word, so `WorkspaceGrid`
  is now `<Workspace>`. `useExperimentState` is `useTrialState`: it was always
  per-tile, which is the conflation this removes. `Experiment` keeps its meaning
  as one `storageKey`'s worth of state — what the lab document holds — so
  `<SingletonExperimentProvider>` is unchanged.

  This is a breaking rename of most of the lab runtime's public surface. Every
  `Workspace*` symbol that meant a tile is gone; there are no aliases.

  CSS classes move with it: `.lk-workspace` (the tile chrome) is `.lk-trial`,
  `.lk-workspace-tile` is `.lk-trial-tile`, and `.lk-workspace-grid` is
  `.lk-workspace`.

  A saved lab opens unchanged. The document format goes to version 2 and its
  migration renames `workspaces` to `trials`; a version-1 document, and a
  pre-document lab still on the four legacy keys, both fold forward on load.

- 77f3d9b: Zoom past 2x reads as a multiplier

  The workspace toolbar and status bar showed zoom as a percentage at every
  scale, so a lab zoomed deep into its geometry read `1600%`. Above 2x they now
  show `16x` instead; at 2x and below the percentage is unchanged.

  Both surfaces went through the same `Math.round(zoom * 100)` expression
  written twice. They now share `formatZoom`, alongside the other display
  helpers in `ui/format`.

- 9a7d4ba: Zoom readout stays legible past 100x

  `formatZoom` switched from a percentage to a multiplier above 2x but kept one
  decimal place at every magnitude, so a trial zoomed to 1009.74 read
  `1009.7x` — a tenth of a multiple is below anything a reader can act on, and
  the digits crowd out the toolbar and status bar. Past 100x the decimal is
  dropped and thousands are grouped, so the same view reads `1,010x`.

  Note that the toolbar's `+` / `−` buttons still bypass the 0.1–32 clamp that
  `usePanZoom` applies to wheel zoom (`TrialChrome` multiplies the current
  zoom and calls `setZoom` directly), which is how a trial reaches four
  digits at all. That inconsistency is unchanged here.

- 23ceef3: Persist a lab as one versioned document rather than four loose keys.

  `lk:<storageKey>:doc` now holds `{version, trials, saves, layout, mode}` and
  hydration runs a migration chain over it. A lab saved under the previous four
  keys is folded into the document on first load; the old keys are removed only
  after the new document is read back and confirmed, so a storage write that
  fails silently leaves the original data intact. A document written by a newer
  labkit than the one reading it is left alone and that store stops persisting,
  rather than being overwritten. A document that fails to parse or migrate is set
  aside under `lk:<storageKey>:quarantine`.

  `serializeTrials` and `deserializeTrials` now take and return records
  rather than a JSON string. Both are internal to the state runtime.

- Updated dependencies [2d30a32]
  - @weasel-js/theme@1.1.0

## 1.0.4

### Patch Changes

- 7bd1817: Tile workspaces with windease instead of CSS grid

  `WorkspaceGrid` now renders a `windease` grid zone. The arrangement is
  unchanged — windease's `gridStrategy` auto-balances to `ceil(sqrt(n))`
  columns, which is what labkit's own `gridDims` computed, verified identical
  for 1–16 tiles — but tiles are absolutely positioned at strategy-computed
  rects rather than laid out by CSS, and `resizable` gives them draggable,
  keyboard-operable seams.

  Two breaking bits for anyone importing them: `gridDims` and its `GridDims`
  type are gone, and `.lk-workspace-grid` no longer sets the
  `--lk-grid-cols` / `--lk-grid-rows` custom properties.

  New `WorkspaceGrid` props: `ids` (stable identity per tile — supply it
  whenever a tile can be closed from the middle, or panes inherit each other's
  dragged extents), `resizable`, `gap`, `padding`, and `viewport` for
  environments where nothing measures.

  `dist/styles.css` gains windease's baseline stylesheet as a layer. Consumers
  import nothing new; the tiles depend on those rules to position at all.

- a542198: Reorderable workspaces, and tile extents that survive a reload

  `WorkspaceGrid` gains four props. `reorderable` (off by default) renders a
  drag handle per tile and reports the order a drop would produce through
  `onReorder` — the grid never reorders `children` itself, so the caller stays
  the owner of the list. `layout` / `onLayoutChange` carry per-tile extents:
  hand the last value back as `layout` and a dragged seam survives a reload.
  Both key off `ids`, and neither does anything without it.

  `<Lab>` wires all four. Workspace order and tile extents now persist
  alongside workspaces, snapshots, and theme, under a new `layout` storage key.

  Also new: `reorderWorkspaces(workspaces, ids)` in the workspace ops, and
  `reorderWorkspaces` on the lab context.

  - @weasel-js/theme@1.0.4

## 1.0.3

### Patch Changes

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

- Updated dependencies [514c34a]
  - @weasel-js/theme@1.0.3

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
