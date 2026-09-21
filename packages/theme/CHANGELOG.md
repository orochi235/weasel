# @weasel-js/theme

## 1.5.2

### Patch Changes

- 24a2dae: Close the places where two tiers spelled one concept differently.
  
  **A fixed pan bug.** `viewport.dragPan` fell back from `drag.screenDelta` to
  the world `drag.delta` and then divided by the zoom anyway, panning at
  1/scale² for any event source that supplies no `clientX`/`clientY` — which is
  every synthesized `InputEvent`, since those fields are optional. It now
  reconstructs the client delta exactly, by undoing each end of the world delta
  against the view that produced it.
  
  **Breaking, renames.** `ClickEvent`, `DoubleClickEvent` and `ContextMenuEvent`
  carry their world point as `x`/`y`, matching every other kind in `InputEvent`;
  `worldX`/`worldY` are gone, and a consumer who set `x`/`y` no longer silently
  lands at the origin. All three now also carry `clientX`/`clientY`, so a
  context-menu action can finally read `ctx.screen` — the case that surface was
  added for. The renderer's `Mat3` is `GlMat3`, freeing `Mat3` to mean geom's
  affine in a file that imports from both. `translatePolygonInPlace` is
  gone: it was the one sanctioned writer into a committed path's coord buffer,
  documented as overlay-only, and nothing called it. `@weasel-js/font` exports `FontStyle`
  in place of `OutlineFontStyle`. `@weasel-js/labkit` no longer exports
  `useOrbit`, `OrbitView`, `Vec3` or their helpers: `@weasel-js/kernel3d` owns
  the orbit camera and `@weasel-js/geom/3d` owns `Vec3`. `ToolCtx.screenPoint`
  was declared and never written by anything; it is gone.
  
  **Breaking, types narrowed.** geom's `Mat3` and `Box` are readonly tuples,
  matching the reason `geom/3d` already gives for its own. `History.entries()`
  returns `readonly` arrays, which is what its docstring always asked callers to
  assume.
  
  **One type where there were two.** `@weasel-js/svg`'s `Matrix` is geom's
  `Mat3`, and its duplicate `multiply` is geom's; `SvgStroke.width` is
  `ScreenLength` rather than that union written out again. `kernel3d`'s
  `ViewportRect` is `ScreenBox` — one rectangle spelling instead of `w`/`h`
  beside `width`/`height` eight lines apart. The renderer's `View` is routing's.
  Core's `Vec2` is routing's `Point2`, and `Pt` is gone from the barrel.
  
  **Additions.** `oklchDegToHex` / `hexToOklchDeg` / `OklchDeg` in
  `@weasel-js/paint` — the degrees-and-hex form `@weasel-js/ui` and
  `@weasel-js/theme` had each built for themselves. `srgbFloatToOklab`, for
  callers holding 0..1 floats; feeding those to `srgbU8ToOklab` truncated where
  paint's own internal conversion rounds. `mat3.toAffine` / `mat3.fromAffine`
  name the repack between the GL layout and geom's.
  
  **Corrections.** `RECT_POSE_DESCRIPTOR` implements `getRotation`, so a pose it
  rotated no longer reports itself unrotated to `useResize` and to diagram's port
  placement. `ToolDef.capabilities` is documented as reaching
  `Tool.eligibility.capabilities`, which is where it actually goes — following
  the old text gave `undefined`, and `eligibleForMode` turns that into a tool
  that vanishes from every mode. `MultitouchEvent.centroid` is documented as
  canvas-local, which is what the dispatcher hands over. `drag.points` is a
  snapshot on `onEnd` rather than the dispatcher's live accumulator.
  
  `tsconfig.json` now typechecks `packages/routing`, `cursor`, `bidi` and
  `loupe`, which it had never included.
- ae2a424: Every property row stands on the same floor.
  
  A row was as tall as whatever it held — 16px around a switch, 20 around a
  field, 24 around a `<Select>` — so a column of mixed rows set its own line
  spacing row by row and read as ragged. `.row` now carries a `min-height` of
  `--wzl-prop-row-h`, which defaults to the panel's own field height and so
  follows `density`. Taller content still grows its row; this only stops a short
  one from collapsing beside the field it sits next to.
  
  Three field-family controls were reading a standalone control's height token
  rather than the panel's, and overshot or undershot the rows around them:
  
  - A kit `<Select>` in a row took `--wzl-control-h` (24px at the default
    density, against a 20px field). Its trigger now reads `--wzl-select-h`, a new
    hook defaulting to `--wzl-control-h`, which the property list points at the
    field height.
  - A segmented `ToggleRow`'s buttons were a hard-coded 26px, and did not move
    with `density` at all.
  - A slider row's readout was pinned to `--wzl-control-h-sm`, so a `tight` panel
    kept comfortable-sized readouts.
- 3978e84: File danger, warning and success under one `status` group.
  
  Each stood alone with two tokens — its base and its semantic — and a token
  panel draws a color group as one row of swatches only from three colors up, so
  the six status colors took six rows between the ramps. The manifest emitter now
  maps those three prefixes onto one group name; nothing else reads the old ones.
- 8081a6b: Derive the type ramp from one number, and add a `density` axis that scales it.
  
  Sizes were unrelated px pins, so there was nothing to turn: raising
  `--wzl-font-size` grew glyphs while `--wzl-control-h` stayed 24px and every gap
  stayed put. The type ramp now derives from `seeds.ui-base` through a new
  `factors` rule on a scale (`base × factors[i]`, alongside the existing `step`
  and `ratio`), and `density` — `compact` / `comfortable` / `roomy` — varies that
  seed along with `control-h` and `tb-height`. Set it with
  `applyTheme(el, theme, { density })`.
  
  Sizes stay baked px rather than `calc()` against a root variable, because
  `tokenPx()` feeds SVG, canvas and WebGL geometry and has to read a real number.
  
  **Additive, with one behavior change.** Every existing token keeps its computed
  value at the default selection; `--wzl-font-size` and `--wzl-space-{xs,sm,md,lg}`
  are now aliases (`var(--wzl-font-size-md)`, `var(--wzl-space-2)` …) rather than
  literals, which computes identically but is no longer a literal string if you
  read the declaration rather than the computed value. New: `--wzl-font-size-md`
  and the `--wzl-space-1` … `--wzl-space-8` ladder in 2px rungs.
  
  `toDTCG` no longer refuses a theme with an axis besides `mode`; it exports that
  axis's default branch and drops the others, since DTCG carries one variant
  dimension. Round-tripping a theme through DTCG now flattens it to the default
  selection of every non-mode axis.
  
  Control heights follow density too, through three new ranks — `control-h-xs`
  (18px), `control-h-sm` (20px) and `icon-button-size` (22px), each landing on a
  value already in wide use so nothing moves at the default density. Without them
  `Button` sat at 24px in every density while its label grew.
  
  Also adopts the ladder across `packages/ui`: 189 `gap`/`padding`/`margin` px
  literals became rungs and the frozen control boxes became ranks.
  `npm run check:spacing` and `npm run check:controls` keep them there; a
  rank-sized box that is really artwork opts out with a `not-a-control` comment.
  
  `check:design-tokens` now reads the scale from `:root` alone. Each density block
  restates the whole scale, so reading the stylesheet straight through left
  `roomy` standing and vetted every authored fallback against a value no unset
  document shows.
- Updated dependencies [24a2dae]
  - @weasel-js/paint@1.5.2

## 1.5.1

### Patch Changes

- 58ba9de: New `--wzl-handle-size`, `--wzl-handle-size-sm` and `--wzl-handle-size-lg` size every draggable handle the kit draws on a plot or a timeline: the default rank, the inert one a locked or pinned point wears, and the emphasized one a curve's endpoint wears. Timeline's dope-sheet keys and event marks, CurveEditor's endpoint and locked diamonds and `createKeyframeLayer`'s keys were three independent literals; they are now one number each, written in the theme definition.
  
  CSS reads the tokens directly. Code that draws rather than styles — SVG geometry attributes, canvas, WebGL — reads them through `tokenPx(name, resolved?)` from `@weasel-js/theme`, or `handleSize` / `handleHalf` from `@weasel-js/ui`, which return the number without a `getComputedStyle`. Pass a `ResolvedTheme` (from `useTheme().resolved`) where a live theme override has to reach the drawing; without one the built-in theme's value is used.
  
  The locked anchor in `createFunctionLayer` was 7.1px and is now 7px.
  
  `@weasel-js/ui` now depends on `@weasel-js/theme`.
- dda4172: A token's alpha extension (`com.weasel.alpha`) now works whatever color the
  token it references holds. Resolving a theme used to throw unless that color
  was a hex literal. Now hex (including 4- and 8-digit forms) and `rgb()`/`rgba()`
  become an `rgba()` literal, and any alpha the color already carried is
  multiplied in, matching what the CSS output's `color-mix()` does. A color that
  cannot be read without a browser — a named color, `hsl()`, `oklch()` — resolves
  to that same `color-mix()`. No existing output changes.
- a39a885: Themes are now authored as layered definitions and built by an engine, published as `@weasel-js/theme/engine`: seeds, generated ramps and scales, semantic rules (a step, an offset from another semantic, the first step that clears a contrast target, a reference), components and pins, any of which can vary by axis. `derive` produces a theme's tokens for one selection with provenance and validation issues, and `bake` folds every selection into a runtime `Theme`. weasel's own theme is `themes/weasel.json`, every value pinned, and emits the same CSS declarations as before. `toDTCG` in `@weasel-js/theme/engine` writes a theme back out as a DTCG document, with aliases written as paths through their type group (`{color.gray-800}`) so DTCG tools resolve them. A pin or component whose whole value is `{seeds.name}` takes that seed's value. labkit's interstellar theme is now `interstellar.theme.json`, a definition extending weasel.
  
  **Breaking.** A theme varies by *axes* rather than modes, and `mode` is one axis:
  
  - `resolveTheme(theme, selection?)` and `applyTheme(el, theme, selection?)` take `{ mode: 'light' }` instead of `'light'`; a missing axis takes its default. `applyTheme` stamps one `data-wzl-<axis>` attribute per axis.
  - `<ThemeProvider selection={{ mode }}>` replaces `mode`, and `useTheme()` returns `selection` instead of `mode`.
  - `Theme` holds `axes` and `tokens` (each token plain or `{ by: 'mode', dark, light }`) instead of `defaultMode`, `tokens` and `modes`. Read an axis default with `themeAxes(theme).mode.default`.
  - `defineTheme` takes `{ name, extends?, axes?, components?, pins? }`, where a pin or component is a value or `{ value, type, alpha, description }` and references are written `{token}` (not `{color.token}`). It throws on a definition with rules; bake those with the engine. `extends` is a `Theme`: passing a definition's name (`'weasel'`) throws and says to pass the `Theme`.
  - A theme that redeclares an axis its parent declares keeps the parent's values: the child's entries for a shared value and the child's default win, and a value only the parent has still resolves through the parent. A DTCG document with only a `dark` mode now resolves `light` from the theme it extends.
  - `THEMES.<name>.modes.<mode>` is now `THEMES.<name>.selections['mode=<mode>']`. `THEME_SOURCES` holds definitions, `BAKED_THEMES` is new, and `TokenInput` and `ThemeSource` are removed.
  - `GeneratedTheme.defaultMode` is replaced by `axes`.
  - `tokens.css`'s `:root` declarations and `TOKEN_MANIFEST`'s rows are in layer order — ramps, scales, semantics, components, then other pins. The values are unchanged, but token browsers list them in the new order.
- 55b5524: `@weasel-js/theme/engine` exports `generateTokens(definitions)`, which returns `tokens.css`, `themes.ts` and `manifest.ts` for a set of theme definitions, or the derive problems that stop them; the package's `gen:tokens` script now calls it. The engine also exports `declaredSteps(entry)`, every step a ramp or scale entry can declare, and the runtime entry exports `isByAxis`.
- 045998f: A theme that declares a ramp or scale now generates those steps itself: pins held on them by the themes it extends no longer apply, while its own pins still do. Previously a theme extending weasel inherited weasel's pins on every gray, accent and swatch step, so none of its own ramps could show. A theme that redeclares a ramp and relied on the parent's pins must pin those steps itself.
- 56cad3a: Three lightness ramp edge cases: a theme whose ramp steps vary by axis now shadows only the inherited pins on steps it declares in every branch, so `derive` no longer throws where a branch omits one; an anchor on a step where the chroma envelope is near zero no longer turns the ramp's other steps gray while a bias moves off 0 (the ramp's chroma still rises steeply there); and a negative `peak`, `lightBias` or `darkBias` is reported as invalid instead of producing `NaN` colors or flipping the hue.
- f9f41e2: A lightness ramp's `chroma` takes `lightBias`, which lifts the first step's chroma off zero as `darkBias` lifts the last: the envelope is now `sin(πt) + lightBias·(1−t) + darkBias·t`. It defaults to 0, so existing ramps are unchanged. Without it, a ramp anchored on one brand color with `darkBias` 0 came out gray at both ends.
- fa56d1e: Token and step names are limited to letters, digits, `-` and `_`. Any other name is reported as invalid and dropped, as a name containing a dot already was; a quote in a name used to reach the generated `themes.ts` unescaped.
  
  `@weasel-js/theme/engine` also exports `bakeChain(definition, lookup)`: the definition and every theme it extends, baked, root first.
- 272ab0d: `serializeTokenValue` and `parseTokenValue` are public. A DTCG value is not
  always a string — a `fontFamily` is a list of names and a `cubicBezier` is four
  numbers — and the only code that knew how to render those was private to the
  CSS emitter. Anything that shows a token value for editing had to fall back to
  `JSON.stringify`, which puts `["Oswald","Helvetica Neue Condensed"]` in front of
  a person and writes it back as the literal value.
  
  `serializeTokenValue` is the emitter's own rendering (a quoted font stack, a
  `cubic-bezier(…)`), and `parseTokenValue` is its inverse, so an edited value
  returns to the shape the definition stores. `resolveTokens` now calls the
  exported function rather than keeping its own copy.
- e0799cb: The ten consumer override hooks — `--wzl-swatch-size`, `--wzl-timeline-label-w`, `--wzl-number-field-width` and seven more — are declared in `packages/theme/src/hooks.ts` and appear in `TOKEN_MANIFEST` as rows with a new `hook: true` field, carrying the fallback kit CSS reads them with and a description of what each one sizes. `TokenManifestEntry` gains that field. The theme README documents them, and `scripts/check-token-reads.ts` now reads the same list instead of holding its own copy.
  
  The manifest is where they belong rather than `tokens.css`, because a hook's contract is that no theme declares it: a `:root` value would outrank the fallback written beside every read, leaving two places that must agree forever, and `check:token-reads` would stop enforcing that the fallback is there. A test asserts the stylesheet declares none of them. The manifest already carries every token's type, default and description for tooling — forge's CSS-vars panel reads it — so the ten now list there beside the tokens, marked as the different thing they are.
- Updated dependencies [f644eac]
- Updated dependencies [626bace]
- Updated dependencies [b981856]
  - @weasel-js/paint@1.5.1

## 1.5.0

### Patch Changes

- 35e36b1: `--wzl-border-strong` now clears WCAG 1.4.11's 3:1 non-text contrast. It sat two
  ramp steps off `surface` and measured 1.3–2.4:1 in every mode; it is now
  `gray-400` in dark and `gray-500` in light, which passes against every surface.
  
  **Breaking:** `--wzl-border-raised` is removed. It was added for the same job, so
  it folds into `border-strong` — replace any reference to it. Checkbox, radio,
  slider, switch and toggle-bar edges get visibly stronger in both modes.

## 1.4.4

### Patch Changes

- d80a7eb: **`tokens.css` no longer sets a document font.** It was the one rule in the
  file that was not an inert custom property, and it re-typed the whole document
  — so an app with its own typography could not import the stylesheet at all and
  hand-wrote the `--wzl-*` bridge instead, which falls silently behind whenever a
  component starts reading a token the list does not carry. The rule moved to
  `fonts.css`, beside the `@font-face` declarations, which is the file that
  already meant "give me the kit's typography". A surface that wants both now
  imports both.
  
  **`--wzl-slider-track-tint` and `--wzl-slider-thumb-tint` are renamed to
  `--wzl-slider-track-mix` and `--wzl-slider-thumb-mix`.** They are the second
  argument of a `color-mix`, so they must be percentages; the old names read as
  colors, and setting one to a color invalidated the declaration and left the
  thumb unpainted with no error anywhere.
  
  **Slider size tokens carry their own defaults.** `--wzl-slider-track-h` and
  `--wzl-slider-thumb-size` were used bare, so unset the track had no height and
  the control was present, focusable, operable and invisible. An incomplete
  bridge now degrades to the wrong size instead of to nothing.
  
  **`ColorRow` and `NumberRow` take `onInput`.** `Slider` and `SliderRow` split
  the live value from the committed one; these rows had a single callback with
  nothing saying which semantics it had, so a consumer with an undo stack got one
  entry per tick. `ColorRow` also takes `onAlphaInput`. A row given one callback
  still fires continuously, as before.
  
  **`RangeSlider`'s track has no `min-width` floor.** The root is a column flex
  container, so `align-items` on it governs the horizontal axis and collapses the
  track — and the 80px floor turned that into a small slider that looked
  deliberate rather than a broken one that would have been found in seconds.
  
  **The property readout's width takes `--wzl-property-readout-w`,** rather than
  leaving a consumer to match the hashed class name.
  
  **labkit mints ids through a helper that checks for `crypto.randomUUID`.** It
  exists only in a secure context, and a LAN address is not one — so a lab opened
  on a phone or a tablet by IP threw on its first render and showed a blank page
  with nothing in reach to say why.

## 1.4.3

## 1.4.2

## 1.4.1

### Patch Changes

- 47c75ca: Stop five border and surface tokens resolving to their dark values in light mode.
  
  `--wzl-line`, `--wzl-line-subtle`, `--wzl-line-strong`, `--wzl-surface-hover` and `--wzl-surface-pressed` are authored as an alpha of `{color.fg}`, which varies by mode. They were emitted only into `:root`, and CSS substitutes a `var()` inside a custom property at the scope where that property is *declared* — so all five resolved once against `:root`'s dark `--wzl-fg` and inherited that frozen value into the light block. Every border in light mode was drawn in the dark palette's near-white.
  
  `build-tokens.ts` now walks each primitive's reference chain and redeclares any token that reaches a mode semantic inside every mode block as well as `:root`. The `:root` values are unchanged, so a surface with no `data-wzl-mode` set behaves exactly as before.
  
  Only the raw `tokens.css` + `data-wzl-mode` path was affected. `applyTheme` re-emits every token as a literal into one mode-scoped rule, so labkit and anything else under `ThemeProvider` was always correct — which is why the Foundations page's own light/dark comparison, which uses the raw sheet, was the one place showing it.

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
