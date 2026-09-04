# @weasel-js/theme

## 1.4.0

### Patch Changes

- 72b30cc: One skin for the kit's sliders and fields.
  
  `@weasel-js/ui` carried six slider treatments, three of which rendered the same
  bare `<input type="range">` with independently hand-authored pseudo-element rules.
  A new shared `range.module.css` is now the single source for that chrome, imported
  by `InlineRange` and by the property rows; a bare range inside a labkit `.lk-root`
  wears it too. New tokens carry the geometry: `--wzl-slider-track-h`,
  `--wzl-slider-thumb-size`, `--wzl-slider-track-tint`, `--wzl-slider-thumb-tint`.
  
  `Slider` — the multi-thumb canvas widget — keeps its own 24px chrome, since a
  gradient track needs a grabbable thumb, but gains `density="slim"` which drives its
  track and thumb from those tokens. `ZoomControl` uses it, so a lab's zoom no longer
  looks like a different design system from the panel beside it.
  
  `NumberField` gains `ghost`: transparent until focused, the readout treatment the
  property rows already had. `hideSteppers` alone still painted the full sunken box,
  which is why `ZoomControl`'s readout could not match a property row.
  
  Boxed fields size from `var(--wzl-field-h, var(--wzl-control-h))` and pad from
  `--wzl-field-pad-x`. Set `--wzl-field-h` on a container to change a whole panel's
  density; `PropertyList` sets its own, so property rows keep their 20px. The
  fallback form is deliberate — it resolves per element, so a toolbar's redeclared
  `--wzl-control-h` still reaches its fields. `--wzl-prop-field-height` is retired;
  nothing ever set it.
  
  `NumberRow` gains a `unit` suffix, matching `SliderRow`, and right-aligns its value
  so a column of numbers shares a decimal position.
  
  Behaviour changes worth knowing:
  
  - `InlineRange`'s thumb is 8px and translucent rather than 12px and solid.
  - Every boxed field focuses with the 1px ring the React Aria fields already used,
    replacing the property rows' bare outline; the colour chip gains a focus ring it
    never had, and the property-row select moves from `--wzl-accent` to
    `--wzl-focus-ring`.
  - A `PropertyRow` rendered outside a `PropertyList` no longer picks up the dense
    20px — density belongs to the container now. Every panel composes the list, so
    this shows only in isolated stories.
  - labkit's mark-title field renders with `Input` instead of a bare `<input>`, so it
    no longer shows user-agent chrome. Its `onChange` now receives the string value.
  
  Removes `--wzl-track-bg`, `--wzl-track-border`, `--wzl-thumb-fill`,
  `--wzl-thumb-border` and `--wzl-thumb-text`, which nothing read.
  
  A number leaf declares its display suffix with `.suffix('px')`, which `ControlPanel`
  passes to the row. `unit` on a leaf keeps its existing meaning — the
  `{ toDisplay, fromDisplay, suffix }` conversion descriptor `SelectionPanel` reads —
  and `ControlPanel` does not interpret it.
- 53ffca9: `gen:tokens` honors `WZL_TOKENS_OUT_DIR`, so the determinism check generates
  into a temp dir and diffs rather than overwriting `tokens.css`, `themes.ts` and
  `manifest.ts` while other tests in the same vitest project are reading them.

## 1.4.0-pre.1

## 1.4.0-pre.0

### Patch Changes

- 53ffca9: `gen:tokens` honors `WZL_TOKENS_OUT_DIR`, so the determinism check generates
  into a temp dir and diffs rather than overwriting `tokens.css`, `themes.ts` and
  `manifest.ts` while other tests in the same vitest project are reading them.

## 1.3.0

### Patch Changes

- 0769eea: Widen the design-token scale: six font-size ranks in place of two, one
  font-weight ladder (300/500/700) shared by both themes rather than two that
  disagree, line-height and letter-spacing tokens where there were none, a pill
  radius, and a shadow token.
  
  Additive except for two removals. `--wzl-font-weight-light` is gone; use
  `--wzl-font-weight-normal`. `--wzl-font-weight-medium` resolves to 500 rather
  than 350 under the base theme, so anything that pinned itself to the old value
  will render heavier.
- c534ff5: Give every control one height, and stop labkit styling weasel-ui by load order
  
  `--wzl-control-h` described itself as the height of a button, input or select
  and claimed 28px, while `Select`, `Input`, `NumberField` and `ComboBox` each
  hard-coded 24px. Nothing enforced the token, so the two numbers had drifted
  apart unnoticed. The four controls read the token now and the token is 24px,
  which is what they already rendered. `ToggleBar` moves off `--wzl-tb-height`
  onto `--wzl-control-h` — a segmented control is a control, not the strip a row
  of them sits in — and its `height` prop writes a private variable so setting it
  cannot cascade into children. `--wzl-tb-height` stays 28px: it sizes a strip
  that *contains* controls, and 24px there would clip the focus ring of a 24px
  control inside it.
  
  In labkit, a class handed to a weasel-ui component through `className` landed
  beside that component's CSS-module class at equal specificity, so whichever
  stylesheet was injected last won. Labkit's element defaults now score (0,0,0)
  so a component always paints its own controls, and deliberate overrides carry a
  `.lk-root` prefix that wins on purpose. That fixes a zoom readout whose field
  had stretched over its own buttons, hiding the leading "10" of "100%".
  
  Also in labkit: `<Lab>`'s nebula backdrop was covered by an opaque shell and had
  never been visible; a trial's config panel was crushed to 60px of a 270px panel
  by its sidebar extras; and the lab header wrapped to three lines because a
  `Select` swallowed the row's slack while the mode toggle compressed past its own
  labels.
  
  `LabProps` gains `footer`, which had no route short of building `LabShell`
  yourself. `LayerCapability.ids` accepts a full `LayerDescriptor` as well as a
  bare string, so a layer can carry a label distinct from its canvas id and be
  marked `alwaysOn` — both already honoured by the layer list, neither
  expressible. Existing `string[]` declarations still typecheck. `Instrument`
  gains a third type parameter for a job's item type, which had been pinned to
  `never`; TypeScript infers all three or none, so a `defineInstrument` call that
  names state and config must name the item type too.

## 2.0.0-pre.0

### Patch Changes

- 0769eea: Widen the design-token scale: six font-size ranks in place of two, one
  font-weight ladder (300/500/700) shared by both themes rather than two that
  disagree, line-height and letter-spacing tokens where there were none, a pill
  radius, and a shadow token.

  Additive except for two removals. `--wzl-font-weight-light` is gone; use
  `--wzl-font-weight-normal`. `--wzl-font-weight-medium` resolves to 500 rather
  than 350 under the base theme, so anything that pinned itself to the old value
  will render heavier.

- c534ff5: Give every control one height, and stop labkit styling weasel-ui by load order

  `--wzl-control-h` described itself as the height of a button, input or select
  and claimed 28px, while `Select`, `Input`, `NumberField` and `ComboBox` each
  hard-coded 24px. Nothing enforced the token, so the two numbers had drifted
  apart unnoticed. The four controls read the token now and the token is 24px,
  which is what they already rendered. `ToggleBar` moves off `--wzl-tb-height`
  onto `--wzl-control-h` — a segmented control is a control, not the strip a row
  of them sits in — and its `height` prop writes a private variable so setting it
  cannot cascade into children. `--wzl-tb-height` stays 28px: it sizes a strip
  that _contains_ controls, and 24px there would clip the focus ring of a 24px
  control inside it.

  In labkit, a class handed to a weasel-ui component through `className` landed
  beside that component's CSS-module class at equal specificity, so whichever
  stylesheet was injected last won. Labkit's element defaults now score (0,0,0)
  so a component always paints its own controls, and deliberate overrides carry a
  `.lk-root` prefix that wins on purpose. That fixes a zoom readout whose field
  had stretched over its own buttons, hiding the leading "10" of "100%".

  Also in labkit: `<Lab>`'s nebula backdrop was covered by an opaque shell and had
  never been visible; a trial's config panel was crushed to 60px of a 270px panel
  by its sidebar extras; and the lab header wrapped to three lines because a
  `Select` swallowed the row's slack while the mode toggle compressed past its own
  labels.

  `LabProps` gains `footer`, which had no route short of building `LabShell`
  yourself. `LayerCapability.ids` accepts a full `LayerDescriptor` as well as a
  bare string, so a layer can carry a label distinct from its canvas id and be
  marked `alwaysOn` — both already honoured by the layer list, neither
  expressible. Existing `string[]` declarations still typecheck. `Instrument`
  gains a third type parameter for a job's item type, which had been pinned to
  `never`; TypeScript infers all three or none, so a `defineInstrument` call that
  names state and config must name the item type too.

## 1.2.0

## 1.1.0

### Patch Changes

- 2d30a32: A theme redefined under a name it already used now replaces its CSS

  `applyTheme` cached emitted rules on `theme.name::mode` and skipped anything
  already seen. `defineTheme` takes a caller-supplied name and enforces no
  uniqueness, so an edit-and-reapply — a module re-evaluated by HMR, a theme
  editor rebuilding its theme — produced a new `Theme` under the same name and
  was swallowed as a cache hit, pinning the first token values for the life of
  the page.

  The cache now holds the rule text it published for each key and republishes
  when it differs. Rewriting the sheet rather than appending keeps it the size
  of the theme set, so a theme reapplied under one name cannot stack rules.

  `resolveTheme` consequently runs on every `applyTheme` call rather than once
  per name. That call happens when the theme or mode changes, not per frame.

## 1.0.4

## 1.0.3

### Patch Changes

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

## 1.0.2

## 1.0.1

## 1.0.0

### Minor Changes

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

- 6855465: Themes are values you can define, extend, and apply.

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

## 0.8.0

### Minor Changes

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

## 0.7.0

## 0.6.0

## 0.5.1

## 0.5.0
