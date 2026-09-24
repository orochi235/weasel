# @weasel-js/labkit

## 1.5.3

### Patch Changes

- bbf1de2: Text drawn in the accent color now reads `--wzl-accent-fg` instead of the accent fill tokens: Properties readouts and their editable input, `NumberField`'s ghost variant, Timeline's checked transport buttons, forge's current story and labkit's button hover. A surface that rebinds `--wzl-accent` to recolor its controls' fills can now set the text color separately. In dark mode the readouts get brighter, since `accent-fg` is the strong accent there. `npm run check:token-reads` now fails on `color:` reading an accent fill token.
- 04ff89b: A color-mode choice with a way back to Auto, as kit surface instead of something each app rebuilds.
  
  `@weasel-js/theme` exports the `ColorModePreference` type (`'auto' | 'light' | 'dark'`), `ColorMode` (`'light' | 'dark'`) and `isColorModePreference`. `@weasel-js/theme/react` adds `useResolvedColorMode(preference)`, which follows the OS setting live under `'auto'` and returns an explicit choice as given, and `useColorModePreference({ storageKey, storage, defaultPreference })`, which holds the choice, optionally remembers it in `localStorage` (or a store you pass), and returns `{ preference, setPreference, mode }`. `mode` is what goes in a `ThemeProvider`'s `selection`. Storage that is missing or throws leaves the choice unremembered rather than failing.
  
  `@weasel-js/ui` adds `ColorModeControl`, the Auto / Light / Dark radiogroup drawn with the mode glyphs, controlled by `value` and `onChange`.
  
  labkit's header now renders `ColorModeControl`, and `<Lab>` and `<LabRoot>` resolve their mode with `useResolvedColorMode`; `LabMode` is an alias of `ColorModePreference`. Switching a lab back to Auto now picks up an OS change made while it was pinned.
- f4712fe: A row can now hold an editor too big for it. weasel-ui's `DialogRow` shows a one-line summary of the value on a button, and the button opens a modal around whatever body it is given; `ListEditor` edits a list of strings one field per entry. In labkit, `.dialog(body)` on any config leaf moves that leaf's control into such a dialog, and `inDialog(body)` builds the same row as a renderer for a panel's `renderers`. The new `f.list([...])` leaf is a list of strings drawn this way by default, and an `f.value` whose default is an array of strings now resolves to it.
- 497727a: `interstellar`'s light mode is weasel's own: violet on cool gray, where it used to be a parchment palette with a copper accent. The theme restyles the dark mode only.
  
  `derive` now lets a child theme's by-axis pin leave a value out, as `defineTheme` already did: that selection keeps what the parent theme produces, whether the parent pins the token or derives it. A pin with nothing underneath it still reports `missing-axis-value`.
  
  `--wzl-secondary-fg` is picked for contrast against `surface` alone, which is solid in every shipped theme, rather than also against `surface-raised`, which `interstellar` draws translucent.
- 7215cd1: New `keySpecsFromShortcut(shortcut, { platform?, legend? })` turns a kit shortcut (`{ key, mod, shift, alt }`) into `KeySequence` keys, spelled for the platform the way `keySpecsFromMods` and `keySpecFromKey` spell them: `⌘ Z` on macOS, `Ctrl Z` on Windows. An optional shift renders as an optional key. It replaces `formatShortcutParts(s)?.map((label) => ({ label }))`, which always printed macOS glyphs and dropped an optional shift. The `ShortcutInput` type it takes is now exported, and labkit's `weasel-ui` passthrough carries the helper.
- 601d72c: `LabSwitcher` (and `LabShell`'s `pages`) now tells hash routes on one document apart. A page whose `href` is a hash route such as `#/dev/tools` is the open page when the location's hash is that route or one under it, ignoring the route's own query; a page without a hash still ignores the hash, so an in-page anchor keeps it marked. The default path now includes `location.hash`, and a trailing slash on a page's `href` no longer stops it matching. `LabShell` also takes `documentTitle`, which it sets as `document.title` while mounted and restores after.
- c0c6971: `sectionTree` rearranges a `ResolvedConfig` so its root sections are groups,
  which is where `PrefsForm`'s rail layout looks for them. A section naming a
  group brings it in whole, so it lands as an indented rail item; a section
  naming a leaf drops it loose into that section's pane. `showIf` and `hidden`
  are applied on the way, and a section they empty is left out rather than
  opening onto nothing. It returns the tree, the config renested to match, and
  `pathAt` to get a config path back from a rail one.
  
  A flat schema's rail was otherwise one unnamed item however many headings the
  panel drew, since a resolved schema keeps its sections beside the tree.
  
  `PrefsForm`, `PrefsDialog` and their prop types now come through
  `@weasel-js/labkit/weasel-ui`, which carried the `Pref*` vocabulary but not the
  components that render it.
- 0ac85d7: A dropdown row's label in the params panel now sits on the same rail as every
  other row's. A select row aligns to its value's baseline by default, which put
  its label ~1.6px below the centered slider and checkbox rows around it, so a
  column of labels stepped at each dropdown. The panel sets
  `--wzl-prop-row-align-text: center`; the `@weasel-js/ui` default is unchanged.
- e9bfe55: A lab's main viewport no longer pads its contents: the workspace runs edge to edge under the header. The `--lk-workspace-pad` custom property is gone.
- f3d9d92: Surfaces can say what kind of content they hold and which of their peers they are. `PropertyPanel`, `PropertyGroup`, `Subpanel`, `Callout`, `Dialog`, labkit's `ControlPanel` and its sidebar sections take `stance` (`scope`, `aside`, `advanced`, `debug`, `danger`, `notice`, `important`, `preview`) and `tone` (an index into the theme's tone list, or a color). The theme draws each stance from `--wzl-panel-*` and `--wzl-stance-*` slots, and a surface given a tone recolors the controls inside it. `ControlPanel` wraps its rows in a titled `PropertyPanel` when given any of `title`, `stance` or `tone`.
  
  `@weasel-js/theme` adds `ColorList` — literals, the categorical generator, a theme ramp, or a function — read with `colorAt`, `colorCssAt` and `colorCount`; `tones` on theme definitions; `<ThemeProvider tones>` and `useTones()`; and `STANCES` / `STANCE_SLOTS`. labkit's `nebula` takes a `ColorList`.
  
  Breaking: `EffectCard`'s `accent` is now `tone`, and `--wzl-effect-card-accent` is gone. `Callout`'s `tone` (`info` / `warning` / `danger`) is now `stance` (`notice`, the default / `important` / `danger`), and `CalloutTone` is removed. A subpanel's rule now reads `--wzl-line-subtle` rather than a fixed translucent white, so it shows in light mode.
- 5fb5bab: Rename `ActionsBar` to `ButtonBar`, along with its `ButtonBarItem`, `ButtonBarProps`, `ButtonBarSize` and `ButtonBarVariant` types. The old name read as a variant of `ActionBar`, which renders actions from the kit's actions registry; this one is a plain strip of callback buttons, the momentary sibling of `ToggleBar` and `OptionsBar`. Breaking: the old names have no alias.
- Updated dependencies [bbf1de2]
- Updated dependencies [16c0da2]
- Updated dependencies [b8ebef6]
- Updated dependencies [dfbed19]
- Updated dependencies [7216628]
- Updated dependencies [a581611]
- Updated dependencies [5f45cb4]
- Updated dependencies [928fa33]
- Updated dependencies [d7577d2]
- Updated dependencies [64f4739]
- Updated dependencies [9689a2a]
- Updated dependencies [90a2d9b]
- Updated dependencies [a9a61f0]
- Updated dependencies [04ff89b]
- Updated dependencies [bfe6a4f]
- Updated dependencies [2af33a4]
- Updated dependencies [9a25ac4]
- Updated dependencies [f4712fe]
- Updated dependencies [f1c96ff]
- Updated dependencies [f04faf6]
- Updated dependencies [0cf6a0d]
- Updated dependencies [23c4282]
- Updated dependencies [7c98a5a]
- Updated dependencies [b466aad]
- Updated dependencies [811abcd]
- Updated dependencies [7c53d1a]
- Updated dependencies [b1c30bc]
- Updated dependencies [6ab0006]
- Updated dependencies [5345efb]
- Updated dependencies [9e77264]
- Updated dependencies [609d801]
- Updated dependencies [497727a]
- Updated dependencies [2da83b8]
- Updated dependencies [1bcbbf6]
- Updated dependencies [f0a74f8]
- Updated dependencies [7215cd1]
- Updated dependencies [5382c7e]
- Updated dependencies [61ba0a2]
- Updated dependencies [87fd8a8]
- Updated dependencies [3ed8213]
- Updated dependencies [f3d9d92]
- Updated dependencies [c24d2c7]
- Updated dependencies [6f14f6f]
- Updated dependencies [c1f82e2]
- Updated dependencies [5ad1478]
- Updated dependencies [ce53e3c]
- Updated dependencies [edf7878]
- Updated dependencies [cf69850]
- Updated dependencies [a4d9250]
- Updated dependencies [5fb5bab]
- Updated dependencies [2efeb82]
- Updated dependencies [97561f1]
- Updated dependencies [89926b5]
- Updated dependencies [6ce2bcb]
- Updated dependencies [959e5e5]
- Updated dependencies [106139a]
- Updated dependencies [9789097]
- Updated dependencies [da3b958]
- Updated dependencies [9f86dec]
- Updated dependencies [731573b]
- Updated dependencies [debfd5d]
- Updated dependencies [3225eb8]
- Updated dependencies [d975afa]
- Updated dependencies [74cc4df]
- Updated dependencies [62d8d7c]
  - @weasel-js/ui@1.5.3
  - @weasel-js/core@1.5.3
  - @weasel-js/theme@1.5.3
  - @weasel-js/svg@1.5.3
  - @weasel-js/kernel3d@1.5.3
  - @weasel-js/loupe@1.5.3
  - @weasel-js/geom@1.5.3

## 1.5.2

### Patch Changes

- 11d949e: Clicking a property row's **label** now toggles whether the row is auto. That
  replaces the hover-revealed pin dot — `PinDot` is removed — and labkit's
  shift-click gesture, and with them `<PropertyRow data-auto-path>`, which
  existed only to route that gesture.
  
  An auto row now hides its control rather than ghosting it, keeping the box so
  the row does not resize on the toggle, and reads out the bare word `auto`;
  labkit's `auto · 18` form is gone. A hidden control is out of reach of the
  pointer and the tab ring, which is also what takes it out of the
  accessibility tree — a test reading an auto row's value has to read the
  element, not the role.
- bbfdacd: Draw the close X at the size of the glyphs around it.
  
  Its arms spanned 5–15 of the 20×20 box while every neighbor spans about 3–17,
  so at the same `size` it read as a smaller icon. The arms now reach 3.4–16.6 at
  a 1.9 stroke, and labkit's title-bar region draws its glyphs at 16 like the
  toolbar and palette regions rather than 14.
- 785cde0: Add Get Info to weaselforge, and let the tool palette hold commands.
  
  `ToolItem` takes an optional `onActivate`. An item carrying one is a command
  rather than a mode: it presses instead of latching, never writes the tool slot,
  and never reports itself as the current tool. Both contribution unions take the
  context generic, with a default that leaves existing call sites alone.
  
  forge contributes **Info** to that palette (⌘I). It opens a dialog holding a
  fixed dossier for the focused trial's story: where it comes from — title,
  export, id, library and file path — the JSDoc written above its export and
  above its meta, and a row per arg with its kind, current value, default and
  description. `indexFile` harvests the two comments and the meta's `component`
  identifier from the AST it was already parsing, so the dossier reads correctly
  for a story nobody has opened.
  
  `useStoryRegistry` gains `isReady(id)`. An instrument exists with an empty
  schema before its frame reports one, so without it a story that has not loaded
  is indistinguishable from a story that takes no args.
- 55ace67: Stop a trial resizing itself as its frame rate ticks. `FpsMeter` held its
  label and its number in one box with a `min-width` covering both, so every
  digit the rate gained or lost changed the readout's width — and in a trial a
  couple of hundred pixels wide, that wrapped the status bar onto a second line
  and back, taking the height out of the canvas above it each time. The number
  is its own cell now, wide enough for a three-digit rate and set in tabular
  figures, and a status bar keeps its sections on one line and clips rather than
  growing.
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
- f9712f0: A lab says how much room its chrome takes.
  
  `<Lab density>` picks the theme's density axis for the lab's own shell —
  `'compact'`, `'comfortable'` (the default, unchanged) or `'roomy'`. The trials
  and their instruments are unaffected: this sizes the header, the sidebar, the
  tool rail and the palette around them.
  
  A lab that is the whole window rather than a panel beside one reads better at
  `'roomy'`, so weaselforge takes it: its chrome goes from 13px body text and
  24px controls to 15px and 28px. A story's frame keeps its own density, which
  is still the workshop's `Density` global.
  
  Get Info was a 40rem box in a full-width window, narrow enough to wrap a story's
  file path onto a second line. It is 52rem now.
- 665ff53: A group's description now draws in every panel that renders one.
  
  `<PropertyGroup description>` puts the text under the heading and above the
  rows, through a new `<PropertyNote>` — a muted paragraph that spans both
  columns, which is the group-level counterpart to `<PropertyRow description>`.
  labkit's `ControlPanel` passes it, so a config group's `.describe()` reads the
  same there as it already did in `PrefsForm`.
- 2e52d31: Panel labels inherit their case, tracking, alignment and width.
  
  `PropertyPanel`, `Prefs` and labkit's `ControlPanel` read four custom
  properties — `--wzl-params-label-case`, `-tracking`, `-align` and `-width` —
  so one declaration on any ancestor restyles every label beneath it. No rule
  declares them; each label carries its default as a `var()` fallback, so an
  override never has to outrank anything. `docs/conventions.md` ("Panel labels")
  has the defaults and which labels each property reaches.
  
  Visible changes at the defaults:
  
  - An inline slider row's label sits on the leading edge. A rule meant to
    bottom-align a stacked row's track outranked the inline layout and packed the
    label against its slider.
  - Every label is uppercase, including `Prefs` row labels, the `Prefs` subpanel
    heading and labkit pair-cell captions, which were sentence case.
  - Tracking comes from the theme's tracking tokens: row labels move from
    `0.04em`–`0.06em` to `--wzl-tracking-wide`, `Prefs` group titles to
    `--wzl-tracking-wider`, matching `PropertyPanel`'s.
  - A `Prefs` row label no longer grows to fill its row. The control stays on the
    trailing edge.
- 41e2223: Draw a group of sizes as one grid of steps, generated from a base.
  
  Three or more numbers, dimensions or durations sharing a group now draw the way
  a color family does: one compact grid, each cell labeled with what its name adds
  to the shared prefix (`2xs`, `1`, `track-h`). A group whose steps all carry one
  unit says it once beside the group name; `slider` and `tracking`, whose units
  differ, keep a unit per cell.
  
  `TokenPanel` takes `scales` and `onScaleChange` for a group that is generated
  rather than authored step by step. Such a group edits its base and its rule —
  one multiplier per step, a constant ratio, or a constant step — with the
  multipliers sitting under the steps they scale, and `refitScale` fits the new
  rule to the steps as they stand when the rule changes. The panel reports the
  parameters; regenerating the values stays with the consumer.
  
  forge's CSS Vars panel wires that to the theme's own scales: the rule comes from
  the definition, the base is read back from the values the frame reports, and the
  steps are regenerated with the engine's `scale` so rounding matches the build.
  A swatch also names its variable in a tooltip the moment it is hovered, in place
  of the browser's delayed `title`.
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
- Updated dependencies [11d949e]
- Updated dependencies [4e02f88]
- Updated dependencies [bbfdacd]
- Updated dependencies [1c695cb]
- Updated dependencies [24a2dae]
- Updated dependencies [665ff53]
- Updated dependencies [2e52d31]
- Updated dependencies [564deb4]
- Updated dependencies [8ffd746]
- Updated dependencies [ae2a424]
- Updated dependencies [dbdd803]
- Updated dependencies [728ad7c]
- Updated dependencies [36dd1a4]
- Updated dependencies [41e2223]
- Updated dependencies [3978e84]
- Updated dependencies [37e8105]
- Updated dependencies [6d79849]
- Updated dependencies [ad6c351]
- Updated dependencies [8081a6b]
  - @weasel-js/ui@1.5.2
  - @weasel-js/core@1.5.2
  - @weasel-js/geom@1.5.2
  - @weasel-js/svg@1.5.2
  - @weasel-js/kernel3d@1.5.2
  - @weasel-js/theme@1.5.2
  - @weasel-js/loupe@1.5.2

## 1.5.1

### Patch Changes

- 7ebfd0f: Controls can be set to auto. Shift-click a row in a labkit control panel — or
  click the pin dot beside its label — and the field stops holding a pinned
  value: the instrument decides instead, and the control draws ghosted at what it
  decided.
  
  `auto` is a value you write anywhere a config value goes, so `setConfig('gap',
  auto)` and a trial's seed config both work. A schema starts a field unpinned
  with `.initial(auto)`, attaches a resolver with `.auto(fn)`, and opts a field
  out entirely with `.manual()` — for a value the instrument cannot receive as
  `undefined`. The sentinel is normalized into a per-trial set of unpinned paths
  at every boundary, so nothing stores or serializes it, and the last pinned
  value stays where it is: un-pinning is lossless, and Reset returns a trial to
  the auto paths it opened on.
  
  A panel is uncontrolled unless it is handed the set: `<ControlPanel>` without
  an `auto` prop keeps the unpinned paths itself, so the dots work in a harness
  that only stores values and the sentinel never reaches its `setConfig`.
  
  This adds API. Property rows in `@weasel-js/ui` take `auto` and `onAutoChange`;
  a `Select`'s trigger and an alpha range read new color and border hooks that
  default to what they already rendered; a control renderer's argument gains two
  fields.
  
  One thing to know before upgrading: a control panel row now contains a second
  button, the pin dot, named `Pin <label>`. A test querying a row's own control
  loosely — `getByRole('button', { name: /Gap/ })` — will start matching both.
  Match the control's exact accessible name, or exclude a name beginning `Pin `.
- 2c596ec: A labkit control panel honors the three presentation fields a schema leaf could
  already declare but `ControlPanel` ignored.
  
  `.pair('Offset')` on two adjacent leaves draws them side by side on one row the
  pair names, the way weasel-ui's `SelectionPanel` merges the same annotation.
  Each cell keeps its own path and writes only itself; a leaf whose control the
  lab draws itself, and one that needs the whole row (a slider, a paint, an
  object), stays on a row of its own.
  
  `.unit(prefUnit(ANGLE_RADIANS, 'deg'))` on a number stores the canonical value
  and edits the displayed one: the field shows 90 for a stored π/2, and the
  bounds and step the schema declares in radians convert with it, so a typed
  degree is clamped against 0..180 rather than 0..6.28.
  
  `.alpha()` on a color says the value carries alpha as `#rrggbbaa`. The row then
  splits it into the `#rrggbb` the swatch holds and the opacity track beside it,
  and rejoins them on every write. Without the split an `#rrggbbaa` default is a
  value the color input cannot parse, so the first edit wrote back black.
- d16e0bd: A lab has a second pane region, `aside`, which holds sidebar sections on the far
  side of the workspace from the sidebar, with its own resizable seam, width and
  fold state. `LabAsideRegion` mounts it under a bare `LabShell`. `Split` takes
  `side: 'end'` to put its sidebar after the content.
  
  forge's CSS Vars panel moves out of each trial and into the lab's aside, where
  it shows the focused trial and names it.
- eb4c4c4: labkit re-exports weasel-ui's `Input` and `InputProps` from its main entry.
  
  forge's CSS Vars panel shows each variable as one row: its name as written, in
  monospace, over a single field holding the value, with the color swatch inside
  the field for a color and a Reset button beside it once overridden. The
  Theme/Story tabs are flat and full height, and they stay at the top with the
  filter while the list scrolls. The list is no longer capped at 60% of the
  viewport; it fills the aside.
- 006cafb: A config node's `validate` now receives the instrument's whole config as its
  second argument, so its errors can depend on the value being validated. This is
  additive: a validator that takes only the leaf keeps working.
  
  forge keeps each config's validation errors apart. Two trials of one story used
  to share a single errors map, replaced by whichever frame answered last; each
  trial now reads the errors its own config produced.
- ff10b99: A lab now tracks a focused trial: `focusedTrialId` on the lab context names the
  trial last pointed at or focused, counting focus that moved into a frame inside
  it, and a trial that `addTrial` or `cloneTrial` opens takes it. `focusTrial`
  sets it. With more than one trial open, the focused one draws its border in the
  accent color. `swapTrial(id, instrumentName, options)` puts a fresh trial of
  another instrument in a trial's place, keeping its tile size and sidebar width.
  
  forge's story tree uses both: clicking a story runs it in the focused trial, and
  Shift-click or Shift+Enter opens another trial. Cmd- and Ctrl-click are left to
  the browser. The tree's text is a step larger.
- bd41197: labkit re-exports weasel-ui's `Select` and `SelectProps`, beside the other ui
  controls it passes through. forge's header globals (Mode, Font, Weight, Width,
  Italic) now use it in place of native selects, each sized to its widest option.
- 9c72667: Mark up a forge story and export the picture with the marks on it. A story instrument now declares an annotation target for the story itself: the frame serializes its own subtree into an SVG `<foreignObject>` and sends it back over the frame's message channel as the target's `base()`, and the target's content box is the size the frame already measures.
  
  labkit's annotation rail gains an `Interact` tool, which is what a lab with an annotating instrument now starts in. The overlay's input box passes pointer events through while the rail holds a tool that makes no marks, so an instrument under it — a forge story, say — stays clickable. Before this, the rail's default `Select` sat over every picture and took every click.
  
  New in `@weasel-js/forge/shell`: `TrialFrame.capture`, `TrialFrame.size` and `TrialFrames.hostRef`. `TrialFrames.connect` takes `capture` alongside `send` and `audit`.
- b7f3f90: Add `<Jog>`, a transport for something counted rather than timed — beat 3 of 24 rather than
  4.20s of 12.00s. Previous, play/pause, next, an optional scrubber and an `n/m` readout padded
  so the row cannot shift as it plays. `<Transport>` remains the continuous-time one.
  
  New `stepBack` glyph, and `step` is now `stepForward`: with two of them, `step` alone no longer
  names a direction. `StepIcon` stays as a deprecated alias of `StepForwardIcon`, but the
  `IconName` union no longer includes `'step'`.
  
  labkit re-exports `Jog`, `Icon` and the playback glyphs, so chrome built on labkit still needs
  no direct `@weasel-js/ui` dependency.
- 39b0cd4: `LabShell`'s header lines its controls up at one height and one middle by
  default. A toolbar placed in the header takes the header's control height rather
  than the compact 22px trial toolbars use, and drops the strip's padding, border
  and background. `<Lab>`'s color-mode toggle runs at the control height instead of
  its small size.
- 8a7d258: New `<LabRoot>`: the element every labkit component expects above it, on its
  own. It carries `.lk-root` — the design tokens, the font stack, the box-sizing
  reset and the element defaults a lab's bare markup is styled by — marks itself
  the portal host for overlays, and applies a theme only when the app has not
  already applied one.
  
  Until now `.lk-root` was written in exactly one place, inside `<LabShell>`, so
  a consumer mounting a labkit piece by itself — a bare `<Workspace>` or
  `<ControlPanel>` — resolved no tokens and had to rebuild the contract from its
  own stylesheet. Wrap it in `<LabRoot>` instead, beside
  `import '@weasel-js/labkit/styles.css'`.
  
  `<LabShell>` renders one rather than writing the class itself; nothing about
  its output changes.
- 4aa184b: Turn labkit's React lint rules back on. Biome enables its `react` domain — `useExhaustiveDependencies` among them — by detecting react in `dependencies`, and labkit declares it as a `peerDependency`, which that detection does not read. The rules had gone quiet, and the four `biome-ignore` comments written against them had decayed into `suppressions/unused` errors, which is how the silence surfaced. The domain is now named explicitly in `biome.jsonc`; no hook-dependency defects were hiding behind it.
  
  With the gate running again: `currentPage` trims a query and fragment with one regex instead of two non-null-asserted `split` results, `<Lab>`'s fallback returns without a wrapping fragment, and two tests drop non-null assertions. A `PaintField` swatch takes its inner radius from `--wzl-border-w` rather than a bare `1px`, and the icon gallery's group heading takes `--wzl-font-weight-bold` rather than `600`, a weight this theme's scale — 200 through 400 — does not contain.
- 97f3252: labkit gains `Specimen`: one page of the kit's controls and chrome, each in a small
  working state, as a preview surface for a theme. It covers weasel-ui's buttons,
  toggles, fields and pickers, property panels and rows, overlays, lists, tool chrome,
  and editors and plots, and labkit's own toolbar, status bar, sidebars, legend, job
  progress, zoom and scale readouts, floating panel and split. Popovers, dialogs and
  toasts portal into the page, so they take the theme the page is under.
  `SPECIMEN_SECTIONS` names its sections; the `labkit/Specimen` story renders it.
- 545c753: **Breaking for installs:** `@weasel-js/theme` moves from labkit's dependencies
  to its `peerDependencies`, at an exact version, alongside `@weasel-js/core`.
  An install that cannot satisfy it now fails with `ERESOLVE` rather than nesting
  a second copy.
  
  labkit's `tsup` and `.d.ts` builds stop inlining theme, for the reason they
  already stop at core: a second copy has an identity its callers compare
  against. Theme owns a React context and `applyTheme`'s handle on the
  `wzl-themes` stylesheet, so labkit's bundled copy gave `<LabShell>`'s
  `useThemeOptional()` a context the app's own `ThemeProvider` had never written
  to — it read `null` and wrapped a second provider over the app's theme. Where
  `adoptedStyleSheets` is missing, both copies also appended their own
  `<style id="wzl-themes">`. Inside the repo aliases resolved both to one source,
  so this only ever appeared against the packed packages.
  
  `test:smoke:consumer` gains a peer-externalization audit that holds it: for
  every package, a `@weasel-js` peer it imports at runtime must appear as an
  external specifier in its own `dist` JS.
- 4f9fd3b: labkit's loupe routes its peek key and its wheel through the gesture dispatcher, as the `loupe.peek` and `loupe.magnify` actions, instead of attaching `keydown`/`keyup`/`blur` on the window and a capture-phase `wheel` on the host. Taking the wheel from a lab's pan/zoom is now the dispatcher's ordinary rule — `loupe.magnify`'s `enabled` declines while the lens is down, so the event goes unhandled and falls through, and while the lens is up the dispatcher stops propagation before React's root listener runs. Aiming the lens stays a plain `pointermove` listener: the gesture grammar names no hover.
  
  `useGestureDispatcher` takes `channels`, switching off any of the four listener groups it attaches to its element — `pointer`, `wheel`, `contextMenu`, `ingest`. Every one defaults on, so nothing changes for a caller that omits it. A mount that wants one gesture should not also have to take the rest of the pipeline's side effects: `contextMenu` suppresses the native menu unconditionally, and `ingest` makes the element a file-drop target. The loupe mounts with three of the four off, which is what keeps right-click and drops working on a lab that turns a magnifier on.
  
  `<LoupeGestures>`, `createLoupeActions` and `LoupeInputApi` are new on `@weasel-js/labkit/loupe`; `useLoupe`'s returned state carries a new `input` member that `<LoupeGestures>` drives the lens through.
- 23b1c66: `usePanZoom` no longer drops zoom steps when two wheel events arrive before the next render. Each wheel step and pan move now starts from the view the previous one produced, not from the last rendered `view`; the `view` prop still wins at the next render, so a consumer that clamps or rejects a view keeps control.
- 1b2c417: A config section can lay out its own rows: `.section(label, { layout, pack })` puts
  every row under that heading in the given label layout and grid packing, over the
  panel's `layout` and `pack`. Say it on any one node in the section; the resolved
  `SectionSpec` carries both. Other sections keep the panel's.
  
  forge's Globals section in a trial's Settings now uses `{ layout: 'inline', pack:
  'pairs' }`: two globals to a row, each with its label beside its dropdown.
- cb5c172: `SelectRow` renders weasel-ui's `Select` rather than a native `<select>`, so a
  property row's dropdown opens the same listbox as every other weasel select. Its
  props are unchanged: an unchosen or unknown value still shows the placeholder. Code
  that drove the row as a native select — `selectOption`, or a `change` event on it —
  now opens the trigger and picks an option instead.
  
  `Select` gains `variant: 'bare'`, which drops the box for a select set in other
  chrome, and reads its value alignment from `--wzl-select-align`. An inline property
  row sets that to `right`, keeping its values against the chevron.
  
  labkit's config panels and forge's trial Settings pick up the change through
  `SelectRow`.
- c6f21e5: The last sidebar section in a pane now runs to the bottom of that pane and drops
  its bottom rule. A short last section used to stop at its content, and its rule
  over the empty pane beneath read as a second, empty zone.
- 313fe15: A saved snapshot now remembers which fields were auto. Loading it restores that
  set along with the config and state, so a field the snapshot had pinned comes
  back pinned instead of being overwritten by the resolver. Snapshots saved by an
  earlier version have no such record and load as before, leaving the trial's
  current auto fields alone. Additive: `SavedSnapshot` gains an optional `auto`.
- d2b8390: `serializeSvg` now reports through `onWarn` what the document cannot carry the way weasel draws it, where it used to drop it silently: a stroke aligned `inner` or `outer` (SVG has no stroke alignment, so it is written centered), text that wraps at its box width (SVG text does not wrap), and text aligned to the center or bottom of its box (SVG text has no box). Weasel reads the last two back from their `data-weasel-*` attributes; other viewers draw them unwrapped and top-aligned. Each message is reported once per call. `SvgStroke` gains `align` so a bridge from a kit `Stroke` can pass it through and have the loss reported. Additive.
  
  labkit's annotation export passes a mark's stroke alignment through, so it is reported too.
- d798e73: `<SwitchRow>` joins `@weasel-js/ui`'s property rows: the same row as
  `<CheckboxRow>`, drawn as an on/off switch.
  
  labkit's `<ControlPanel>` now reads the annotation `f.boolean(…).toggle()`
  writes and draws one, in a row of its own and in a paired cell. It drew a
  checkbox for both before, so a schema asking for a switch got one in
  `<PrefsForm>` and not in a lab.
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
- 0d169d0: `useTiledSurface` now returns the same handle across renders. A new handle each render reached `useSurfaceTile` through `SurfaceContext` as a new ref callback, which unregistered and re-registered every tile and made the next frame retile and repaint the whole surface.
- 5e79d5b: weasel-ui gains `TokenPanel`, which edits a set of design tokens by type. It files
  tokens into collapsible sections (Color, Type, Size, Motion, Depth, Other), draws a
  color group of three or more as one row of swatches sized to fit — picking a swatch
  opens that token's editor — and gives each type its control: a number that keeps its
  unit for dimensions, durations and numbers, the nine weights for a font weight, a
  curve beside a `cubic-bezier()`, a swatch beside a color, and text for the rest. An
  overridden token offers Reset. `tokenCategory` and `inferTokenType`, which reads a
  DTCG type off a value, are exported beside it. labkit re-exports all of them.
  
  forge's CSS Vars panel is now a `TokenPanel`. The Theme tab takes each token's type
  and group from the theme's manifest; the Story tab uses the manifest for a token it
  knows and infers the rest, and which sections are collapsed persists with the lab.
- 70e9fad: Every `--wzl-*` custom property the components read is now one a theme declares,
  or a documented override hook. A read of a name nothing declared resolved to
  nothing, which silently dropped the whole declaration it sat in.
  
  What changes on screen, in labkit's lab switcher: its menu items take the body
  font size instead of inheriting the title's, the trigger turns the accent color
  on hover, and the menu's shadow, like the floating workspace panel's, now takes
  its color from `--wzl-shadow` so it follows the theme and mode. The menu stacks
  at `--wzl-z-overlay`. In `@weasel-js/ui`, the disclosure chevron eases with
  `--wzl-ease-out-cubic` and a property card's remove button reads `--wzl-danger`
  directly; both render as before.
- Updated dependencies [7ebfd0f]
- Updated dependencies [5769e02]
- Updated dependencies [f644eac]
- Updated dependencies [894a52c]
- Updated dependencies [9becb93]
- Updated dependencies [b984947]
- Updated dependencies [7e9a230]
- Updated dependencies [72fde09]
- Updated dependencies [e9051ac]
- Updated dependencies [9893d53]
- Updated dependencies [626bace]
- Updated dependencies [58ba9de]
- Updated dependencies [776e8b9]
- Updated dependencies [2adcc06]
- Updated dependencies [b7f3f90]
- Updated dependencies [f4049be]
- Updated dependencies [e99c441]
- Updated dependencies [4aa184b]
- Updated dependencies [432b143]
- Updated dependencies [4f9fd3b]
- Updated dependencies [91973a7]
- Updated dependencies [86be3eb]
- Updated dependencies [51372f1]
- Updated dependencies [075f88a]
- Updated dependencies [a5ff296]
- Updated dependencies [2a63f31]
- Updated dependencies [66e0e10]
- Updated dependencies [8b79c20]
- Updated dependencies [b6a5eed]
- Updated dependencies [98ad39c]
- Updated dependencies [67f3867]
- Updated dependencies [f663199]
- Updated dependencies [a80e8db]
- Updated dependencies [b1bf884]
- Updated dependencies [a7519a1]
- Updated dependencies [187593e]
- Updated dependencies [08a3aec]
- Updated dependencies [d963d14]
- Updated dependencies [edb825a]
- Updated dependencies [229a16a]
- Updated dependencies [f9feecc]
- Updated dependencies [b981856]
- Updated dependencies [cb5c172]
- Updated dependencies
- Updated dependencies [b5e7a17]
- Updated dependencies [0662a2d]
- Updated dependencies [9dcf9de]
- Updated dependencies [7ff81e2]
- Updated dependencies [a37cea1]
- Updated dependencies [c0fa540]
- Updated dependencies [d2b8390]
- Updated dependencies [0923159]
- Updated dependencies [20bd67b]
- Updated dependencies [5fbec37]
- Updated dependencies [cba02cc]
- Updated dependencies [d798e73]
- Updated dependencies [21ce23e]
- Updated dependencies [dda4172]
- Updated dependencies [a39a885]
- Updated dependencies [55b5524]
- Updated dependencies [045998f]
- Updated dependencies [56cad3a]
- Updated dependencies [f9f41e2]
- Updated dependencies [fa56d1e]
- Updated dependencies [272ab0d]
- Updated dependencies [ff17dd7]
- Updated dependencies [f2b8d57]
- Updated dependencies [b49c1e7]
- Updated dependencies [e0799cb]
- Updated dependencies [272ab0d]
- Updated dependencies [5e79d5b]
- Updated dependencies [70e9fad]
- Updated dependencies [b40b4ee]
- Updated dependencies [c7545c4]
- Updated dependencies [15b5eca]
- Updated dependencies [0c46089]
- Updated dependencies [29f6ed0]
- Updated dependencies [fb6d8e5]
- Updated dependencies [ca7c737]
  - @weasel-js/ui@1.5.1
  - @weasel-js/core@1.5.1
  - @weasel-js/svg@1.5.1
  - @weasel-js/theme@1.5.1
  - @weasel-js/kernel3d@1.5.1
  - @weasel-js/loupe@1.5.1
  - @weasel-js/geom@1.5.1

## 1.5.0

### Minor Changes

- b25b09b: <!-- bump-approved: minor: maintainer — asked for 1.5.0 in the session that added the async ComboBox surface -->
  
  `ComboBox` can take its options from a server, and a new `useAsyncOptions` hook
  does the fetching.
  
  **`useAsyncOptions({ load, debounceMs, minLength })`** returns `{ options,
  isLoading, loadError, inputValue, onInputChange }`, shaped to spread into a
  `ComboBox`. It debounces the query, aborts a request superseded by a later
  keystroke, and reports a rejected load separately from an empty result. Its
  race guard is a sequence number rather than a liveness flag: two requests from
  adjacent keystrokes are both live, so a flag cleared by effect cleanup does not
  stop a slower first response from overwriting a newer one. `options` holds the
  last *resolved* list and is never emptied to mean "working", so the previous
  rows stay on screen and stay arrowable while the next request is out.
  
  **`ComboBox` gains four props.** `filter` is `'contains'` (the default, and
  today's behavior), `'none'`, or a predicate. `'none'` shows every option given —
  what a list a server already ranked needs, since React Aria's own substring pass
  would drop rows that do not contain the query and reorder whatever survived. It
  also implies `allowsEmptyCollection`, because a list the kit does not filter can
  arrive empty mid-query and the popover would otherwise close before `emptyLabel`
  could be seen. `isLoading` marks the field pending with `aria-busy` and a
  spinner. `loadError` shows the new `errorLabel` in place of `emptyLabel`.
  `onCommit` fires on Enter and on click with `{ source: 'option', key }` or
  `{ source: 'text', text }`, so a consumer that accepts custom values no longer
  has to reassemble "the user committed something" from two callbacks and a key
  press.
  
  `ComboBox` also has keyboard tests for the first time — real key presses
  asserting that the arrows move the active option and that Enter commits it.

### Patch Changes

- 9190fc9: Follow-ups a 3D lab turned up while driving core's dispatcher over a WebGL
  viewport. Each one is a place the kit assumed its own 2D renderer.
  
  **`classifyTarget` and `affordanceAt` now take the world point their types
  promise.** Both were handed the raw client point at every dispatcher call site,
  so `<SceneCanvas>` and `<CanvasView>` each wrapped their thunk in the same
  `clientToWorld` they also passed the dispatcher, and a consumer hit-tested in
  one space while reading `ctx.world` in another. The conversion happens once now,
  where the event arrives. Behavior-identical for both kit consumers; a consumer
  passing no `clientToWorld` sees identity. **If you pass either option to
  `useGestureDispatcher` yourself and convert coordinates inside it, remove your
  conversion.**
  
  **`InvocationCtx.screen` carries a screen point, and is optional.** It was
  filled from the same field as `ctx.world`, so it had never been screen-space.
  It now comes from the event's client coordinates and is absent where the event
  carries none — a keystroke, a UI-driven trigger, a synthetic probe. A
  view-mutating drag still wants `drag.screenDelta`. A click's `ctx.world` is the
  click's own position rather than the origin.
  
  **`scene.history` publishes the `History` a `Scene` already owned.** The kit's
  `undo`/`redo` actions resolve a `history` dep and a consumer had nothing to give
  them, so `<SceneCanvas>` cast the Scene itself through `unknown`. It is a façade
  rather than the private engine: mutating members route through the scene's own
  wrappers, so an action-driven undo bumps the version and notifies subscribers.
  
  **`resolveOverlays` is the overlay half of the in-flight gesture channel.**
  `resolvePreviews` already answered for the ghosts a gesture displaces; this
  answers for the chrome it draws that is no node at all — a marquee rect, a lasso
  trail, an insert outline — in world geometry, with every degenerate case
  dropped. `insertPreviewExtent` is exported alongside it.
  
  **Every overlay variant is now geometry, and the layer owns the paint.**
  `OngoingOverlay`'s `'commands'` variant — arbitrary `DrawCommand[]`, which only
  core's own 2D renderer could execute — **is gone**, along with the `opaque` flag
  on the resolved form and the `action.commands` chrome id. Its two producers
  publish the new `'polyline'` variant instead: a run of world points plus a
  one-word `OverlayRole` (`'cut'` for `slice`, `'connector'` for
  `@weasel-js/diagram`'s `connect`) that a painter maps to a stroke, falling back
  to plain chrome for a role it does not know. `useDispatcherOverlayLayer` draws
  both exactly as they were drawn before, and
  `DispatcherOverlayStyle.roles` is where a consumer restyles one.
  **`ConnectActionOptions.stroke` is removed** — an action no longer names a
  paint; use `roles: { connector: … }` on the layer's style.
  **If you produced a `'commands'` overlay**, publish a `'polyline'` for a line,
  or paint it from a render layer of your own.
  
  **labkit stacks two surface buffers around the trial DOM.** The shared buffer
  sat over the trials, which is right for a mark annotating an instrument and
  wrong for an opaque renderer that buries its own pane. `useSurfaceCanvas('under')`
  asks for the lower buffer; the default is unchanged. **`SurfaceCanvasContext`
  now carries `{ over, under }` rather than one canvas** — a consumer providing it
  directly must update the value.
  
  **labkit labs get their own chrome regions.** Every region was per-trial, so a
  lab-level control had nowhere to go and `LabPalette` existed by casting a
  two-field object through `as unknown as TrialChromeContext`. `<Lab labChrome>`
  takes contributions shaped exactly like a trial's, against a real lab context.
  
  `docs/extending.md` now states the contract for mounting tools outside
  `<SceneCanvas>`, including the half that was written down wrong: capability
  eligibility resolves through `RuleCtx.allowedCapabilities` and `getRuleCtx`, not
  the `activeTool` dep.
- bc78766: Annotation marks now behave on a moving picture. A wheel over a mark zooms the trial's camera, where it used to be swallowed by the mark's input box; a mark no longer leaves a copy of itself behind when its tile moves; and the stage and canvas stack listen for the wheel actively, so `preventDefault` keeps the page from scrolling under the zoom.
- 35e36b1: `--wzl-border-strong` now clears WCAG 1.4.11's 3:1 non-text contrast. It sat two
  ramp steps off `surface` and measured 1.3–2.4:1 in every mode; it is now
  `gray-400` in dark and `gray-500` in light, which passes against every surface.
  
  **Breaking:** `--wzl-border-raised` is removed. It was added for the same job, so
  it folds into `border-strong` — replace any reference to it. Checkbox, radio,
  slider, switch and toggle-bar edges get visibly stronger in both modes.
- cf85a67: An instrument can declare a `title`. A trial of it reads that title in its
  title bar and `aria-label` until the trial is given one of its own, and
  `setTitle(null)` returns to it; the header's "Add trial" menu lists instruments
  by it too. Without a `title`, both read the instrument's `name` as before.
- 2f1ddd0: `@weasel-js/kernel3d` is a new package: poses, an orbit camera, ray picking and screen-projected chrome geometry over core's scene graph and dispatcher. It hosts a renderer rather than owning one — a consumer brings its own and the kernel hands it poses — and it takes core as a peer, the same tier `svg`, `diagram` and `loupe` sit in.
  
  Core took no diff for it. `Scene` is generic over its pose and holds a `Pose3` with no adapter; a 3D host passes the dispatcher an identity `clientToWorld` so `ctx.world` stays two numbers and each dep rebuilds the ray from the camera it closes over; tools transfer untouched. The two things that do not transfer are stated rather than guessed: `ViewApi` has no orientation, so the kernel declares a `camera3d` dep of its own, and `PoseDescriptor.remapBounds`/`fromBounds` throw, because a screen rectangle does not name a 3D pose without a depth.
  
  `@weasel-js/geom` gains a `./3d` subpath — vectors, quaternions, 4x4 matrices, ray/AABB and ray/plane intersection, and `transformAabb`. Dependency-free like the rest of the package, and immutable tuples rather than classes, so a pose survives `structuredClone` with its methods intact because it never had any.
  
  Two corrections to code promoted out of the 3D lab. `projectAabbToScreen` now clips each of the box's twelve edges against the near plane instead of dropping the corners behind it; the old behaviour reported a box too small for anything straddling the near plane, and reported almost nothing for a solid the camera sits inside. And the seam that says how big a node is now asks for its world box rather than a local one to transform: a sphere's box is the same under every rotation, and no transform of a local box reproduces that.
  
  `sceneFromJSON`'s `options` argument is now optional. Every field in it already was, so the natural one-argument call did not compile.
  
  Also new: a test that a quaternion pose survives `toJSON` and `sceneFromJSON` with its rotation intact. The claim that `Scene` is dimension-neutral had only ever been run against `setPose` and undo.
- 42400c9: `<Lab addTrial={false}>` leaves the header's "Add trial" control out, for a lab
  that opens its trials some other way. The default is unchanged.
- 83d7aa0: An instrument can move a stored config's values when its schema renames a key.
  **`Instrument.migrateConfig(stored)`** runs on every stored config as a lab
  loads — trials, saved snapshots, and records another tab writes — before the
  instrument's defaults fill the gaps, so renaming `gridSize` to `grid.size` keeps
  the value a user set rather than resetting it. It runs on configs already
  moved, so it has to return a current one unchanged.
- ffe18ef: **`LabContribution` takes its chrome context as a type parameter.** It defaults
  to `LabChromeContext`, so a `<Lab>` call site reads exactly as it did; a
  consumer mounting the regions under a bare `<LabShell>` now writes
  `LabContribution<MyCtx>` instead of composing `ContributionBase` and
  `ToolbarItem<MyCtx>` by hand or fabricating a lab context. `contributionsIn`
  carries the same parameter.
- f233e30: `<Lab>` takes `pages` and `path`, forwarding both to the shell it already
  renders. `<LabShell>` has had them all along — given two or more pages the title
  becomes the switcher that reaches the project's other labs — but a lab built on
  `<Lab>` had no way to pass them, so it could be reached from another lab's
  switcher and offer no way back.
- 39ace84: Two fixes to `<LabSwitcher>` found against a real consumer's header.
  
  The menu takes the opaque `--wzl-surface` instead of `--wzl-surface-raised`,
  which is translucent by design — it is for panels that blur what sits behind
  them, and the menu sets no backdrop-filter. Over a lab's sidebar the controls
  behind it read straight through.
  
  The title no longer wraps. A consumer's header is usually a crowded flex row,
  and the title is a click target now: left to wrap, `brick-icons corpus` breaks
  after the hyphen and the control reads as three ragged lines with a caret
  adrift from them.
- 95588b7: Annotation tools now live in the lab's tool rail and write the lab's tool slot, so one tool is armed across every trial. A trial whose instrument declares `annotations` no longer gets a palette or a tool slot of its own; a lab whose own `tools` reuse an annotation tool id (`select`, `rect`, …) now throws on the collision.
- 32ed674: A lab can persist to any substrate, and two tabs of one lab no longer discard
  each other's work.
  
  `StorageAdapter` is asynchronous and stores structured-clone values:
  `get`, `list(prefix)`, `set`, `delete`, and an optional `subscribe` that reports
  writes made by someone else. New `createIndexedDbAdapter` / `indexedDbAdapter`
  keep binary and non-JSON state and hear other tabs through a
  `BroadcastChannel`; the localStorage and URL-hash adapters hear them through the
  `storage` and `hashchange` events.
  
  A lab is stored as one record per trial, snapshot, layout and so on, under one
  prefix, and the newest write to a record wins — an edit to one trial in one tab
  and to another trial in a second tab both survive. Existing labs fold forward
  on first open; the old document is deleted only once the records read back.
  
  `<Lab storageKey="…">` alone now persists (to IndexedDB, falling back to
  localStorage), shows `fallback` — by default the empty shell — while it loads,
  and opens once under StrictMode. `usePersistedState(name, initial)` is
  `useState` whose value survives a reload, and `<Persistence>` provides it
  outside a lab.
  
  **Breaking:** custom `StorageAdapter`s must implement the async methods.
  `createLabStore` no longer takes storage — `openLabStore` reads a stored lab.
  `<Lab storage>` without `storageKey` is a type error, and `storage={null}` is
  gone (omit both). `FloatingPanel`'s `storageKey` is replaced by `persist`, which
  remembers only inside a lab or `<Persistence>`. `AnnotationStorage.load` returns
  a promise. `SingletonExperimentProvider` renders its `fallback` until loaded.
- 37ebba6: Exported config schemas now emit declarations. The `f.*` builder node classes (`BaseNode`, `NumberNode`, `BooleanNode`, `StringNode`, `ColorNode`, `EnumNode`, `ValueNode`, `CustomNode`, `GroupNode`) are exported as values from `@weasel-js/labkit` and `@weasel-js/labkit/config`, so a declaration can name them and a consumer can extend them.
- ed849b7: The config builder is published as its own entry, `@weasel-js/labkit/config`: `f`, the path helpers, `resolveConfigSchema` and the rules, without the lab's components or their stylesheets.
- 4502f91: `<Lab>` fits whatever it is mounted in without scrolling. `.lk-shell` was
  `100vh` while `.lk-lab` was `100%`, so a lab embedded in a fixed-height box
  spilled past it by the difference, and the page-level reset only reached a lab
  mounted directly under `<body>`. The shell now fills a container of definite
  height and falls back to the viewport (`100dvh`) when the container has none,
  so a lab behind any number of wrapper elements fits the window with no
  `html, body, #root { height: 100% }` from the host. The reset keeps only
  body's margin. `LabShell` used standalone gets the same rule.
  
  `.lk-shell-body` is a flex column, so children can size with `flex: 1` rather
  than `height: 100%`, and a workspace wrapped for floating panels shrinks in the
  lab body like a bare one.
  
  In development, `<Lab>` warns once when its shell body or the page scrolls
  because of it, naming the element that reaches furthest past the bound.
- 2f6480d: A lab has a `sidebar` region: `labChrome` contributions with `region: 'sidebar'` render as foldable sections in a resizable column left of the tool rail. Fold state and width persist lab-wide. A lab with no sidebar contributions renders exactly as before. `SidebarRegion` is now generic over `SidebarSlotContext`, so a chrome without tear-out can host it.
- ffffe49: `<Lab>`'s `instruments` may now change while it is mounted. An added instrument can open trials and its state serializes through its own hooks; an instrument replaced by a different object has its open trials' and saves' configs refilled from its new defaults before it renders. An instrument dropped from the list keeps its hooks, so the trials it leaves open still persist their state correctly. The store holds the list (`LabStoreState.instruments`, `setInstruments`), and a trial reads its instrument from the store alongside its record. Hoist or memoize the list: a new object each render counts as a replacement.
  
  `createAnnotationStore`'s `meaning` option also accepts a function, read at each capture, so a store built once can follow a capability that changes.
- 294944f: labkit re-exports `ToggleBar` and `Button`, with their prop types, from its
  package root alongside the property rows, so chrome built on labkit needs no
  direct `@weasel-js/ui` dependency to use them.
- 2ca8bf5: A page built on `<LabShell>` no longer scrolls by the body's default margin
  
  The host reset in `styles.css` zeroed the body margin only on a page that mounts
  `<Lab>`. `<LabShell>` also fills the viewport, and without `.lk-lab` on the page
  the body kept its 8px margin, so the page was 16px taller than the window. The
  reset now applies to either.
- 70a88b6: `Split` is the resizable two-pane strip a trial's sidebar sits in, exported from
  `primitives` for any other box that wants one. `TrialBody` is now a thin wrapper
  over it and renders the same DOM.
- f28e29d: Add a `stage` capability: an instrument whose picture is DOM declares its content size, and the trial pans and zooms it through the trial's camera the way it does a canvas — wheel, drag, and the zoom controls, which now appear for either capability. The content opens centered and shrunk to fit unless `initialView` says otherwise; `fitStage` and `<Stage>` are exported for hosts building their own.
- 6203e60: A trial's root element carries `data-trial-id`, so a lab can find a trial's DOM from outside.
- 7256ac8: **`MenuButton`** is a button that opens a list and acts on the row chosen,
  holding no value of its own. It sizes to its label, not its widest row.
  
  labkit's "Add trial…" (with more than one instrument) and "Load…" snapshot
  controls are now `MenuButton`s rather than `Select`s held at no selection. A
  screen reader announces them as menus, and the fixed 160px and 88px widths are
  gone.
- 794b4ff: A number pref can name how its value is shown. `ToolPrefNumber.format` is
  `'plain'` or `'compact'`, and labkit sets it with
  `f.number(0).range(0, 2_000_000).format('compact')`. A compact readout keeps a
  value's precision below a thousand and abbreviates above it at one decimal:
  `950`, `40.0K`, `2.0M`.
  
  `SliderRow` takes the same choice as `notation`, and its readout reads typed text
  through the new `parseNumber`: thousands commas and a `k`/`m`/`b`/`t` suffix are
  accepted, so `2.5m` commits 2,500,000. An emptied readout now reverts instead of
  committing zero. `formatCompact` and `parseNumber` are exported beside
  `formatNumber`.
  
  **A slider readout is no longer narrower than its own values.** The box was a
  fixed width, so a six-digit value lost a digit and read as a smaller number. It
  now widens to fit the longer of its formatted `min` and `max`, and rows whose
  values already fit keep their width. `--wzl-property-readout-w` still sets the
  floor.
  
  `NumberRow` and `PrefsForm` ignore the format: one edits through a native number
  input that cannot display `2.0M`, and the other's sliders show no value.
- edd5b39: `createPoseFeed(scene)` is the channel a renderer weasel does not own uses to
  keep its objects in step with a `Scene`. It publishes `added` / `removed` /
  `changed` with effective poses, so a retained renderer mutates only what moved
  instead of rebuilding every node's draw record on any change.
  
  It reads the scene's two clocks separately. Committed edits bump
  `Scene.getVersion()` and cost one `O(n)` walk of three reference comparisons per
  node — the scene mutates node objects in place and swaps their `pose` and `data`
  references, so it is those the feed snapshots. A drag lives in `Scene.overrides`,
  which names the ids it touched and costs `O(changed)`, so the walk never runs on
  the hot path. A `FeedNode` carries the effective pose beside the node's committed
  one, so a host can draw both without a second channel.
  
  The delta carries no order: a host that draws in order re-reads
  `renderOrderNodes()`, which is cached until a structural edit. The feed does not
  coalesce notifications either — that is the host scheduler's job.
  
  The 3D lab is the first host.
- eaf38e2: A shared surface now clears itself when its tiles move.
  
  Cloning a trial, closing one, or resizing the window left the previous layout's
  pixels wherever the new layout does not cover: a tile that moves or shrinks
  takes its scissor with it, and nothing paints over what it vacated. In the 3D
  lab that read as a second viewport smeared across the gap between panels.
  
  `SurfaceFrame` gains `retiled` — true on any frame where the tile geometry
  changed — and `SurfaceHandle` gains `registerClear(id, fn)`. Every registered
  clear runs, before any painter, on such a frame. It has to be the tenant's
  call and not the painter's, because tenants paint in sequence and the second
  would wipe the first; and it cannot be the owner's, because labkit owns the
  canvas and never the context. `canvas.width = <its own value>` is not a way
  out: assigning the same value resizes nothing, so it clears nothing.
  
  Two smaller fixes ride along. An invalidation the owner makes from inside
  `onFrame` — what sizing the buffer forces — was discarded by the frame loop's
  trailing clear, so a resize could leave tiles blank until something else
  dirtied them. And painters now see what the owner dirtied during the same
  frame rather than a frame later.
  
  It also measures until the layout stops moving. `node.placementChanged` fires
  when a move is ordered, not when it lands, and a panel whose size settles while
  its position is still animating gives `ResizeObserver` nothing more to report —
  so a tile painted for the rest of its life at wherever it was caught mid-flight,
  which is why cloning a few trials left viewports sitting between their panes.
  A measurement that finds anything moved now schedules another, and the run ends
  on the first one that finds nothing moved.
- 6beda78: Adds a `3d-lab` example: a WebGL viewport driven by weasel core's dispatcher,
  actions and select tool. Run it with `npm run dev:3d` from `packages/labkit`.
  
  It exists to answer what a 3D kernel would owe core, and it answers the main
  one — nothing about the dispatcher changes shape. Findings are in
  `docs/superpowers/specs/2026-08-22-3d-kernel-design.md`.
  
  Two bits of infrastructure came with it, because `examples/` reached neither
  before: the lab is in the root `tsconfig.json` include list, and the `labkit`
  vitest project's glob now covers `examples/` as well as `src` and `scripts`.
  
  Dragging a solid paints a ghost. `moveAction` keeps the interim pose on its
  handle and commits one op on drop, so the lab reads those poses off the
  dispatcher's in-flight handles and draws them translucent over a footprint on
  the ground plane, while the solid stays at its committed pose until the drop.
- ab90aa7: Views now clamp zoom to a positive floor. A view's zoom is always finite and at
  least `ZOOM_FLOOR` (1e-9); a zoom of 0, a negative one, `NaN` or `Infinity`
  becomes the floor, and a non-finite position becomes 0. Dev builds warn once
  when that happens. A negative `View.scale` axis is still a flipped (y-up) axis
  and keeps its sign.
  
  The rule lives in `normalizeZoom`, with `normalizeView` applying it to a `View`,
  and every place a view enters the kit goes through it: `<Canvas>` and
  `<SceneCanvas>` (the `view` and `defaultView` props, `setView`, the `view` dep),
  `<CanvasView>` (including a thunked `view`), `<SceneViewCanvas>`,
  `<MinimapCanvas>`, `createViewportLayer`, camera animation targets, `zoomAt`,
  `fitViewToBounds` and `fitZoom`. In labkit, `CanvasStack`, `Stage`, `usePanZoom`,
  `zoomAt`, `centerOn`, `ZoomControl`, a trial's zoom chrome and `as2DView` do the
  same through the new `normalize2DView` and `withZoom`. A loupe's magnification
  follows the same rule.
  
  So `screenToWorld`, `canvasCoords` and affordance hit-testing stay finite
  without handling a zero zoom themselves. `pxExtent` no longer guards a zero
  axis, which a view can no longer have, and labkit's `zoomAt` now treats a
  non-finite opening zoom as the floor rather than as 1.
- Updated dependencies [9190fc9]
- Updated dependencies [a2feeb0]
- Updated dependencies [3ecc1be]
- Updated dependencies [b25b09b]
- Updated dependencies [dd48085]
- Updated dependencies [35e36b1]
- Updated dependencies [efaf707]
- Updated dependencies [7586835]
- Updated dependencies [6385c68]
- Updated dependencies [2f1ddd0]
- Updated dependencies [ea285a2]
- Updated dependencies [c758b4d]
- Updated dependencies [7256ac8]
- Updated dependencies [a41a83a]
- Updated dependencies [794b4ff]
- Updated dependencies [b65f4df]
- Updated dependencies [59bdabb]
- Updated dependencies [aa45d32]
- Updated dependencies [90f0bd8]
- Updated dependencies [b5b8b69]
- Updated dependencies [441304e]
- Updated dependencies [b2f2d45]
- Updated dependencies [6f5ff46]
- Updated dependencies [edd5b39]
- Updated dependencies [2e2041b]
- Updated dependencies [65806bc]
- Updated dependencies [a614be4]
- Updated dependencies [ef60ff6]
- Updated dependencies [269d432]
- Updated dependencies [486f631]
- Updated dependencies [2adc840]
- Updated dependencies [0f374d8]
- Updated dependencies [d25a09d]
- Updated dependencies [deb9e79]
- Updated dependencies [830cf7e]
- Updated dependencies [50d2881]
- Updated dependencies [28d5111]
- Updated dependencies [a5f738a]
- Updated dependencies [ab90aa7]
  - @weasel-js/core@1.5.0
  - @weasel-js/ui@1.5.0
  - @weasel-js/theme@1.5.0
  - @weasel-js/geom@1.5.0
  - @weasel-js/kernel3d@1.5.0
  - @weasel-js/loupe@1.5.0
  - @weasel-js/svg@1.5.0

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
- 69dadfb: `fracIntersects` is now `fracEncloses`.
  
  It never intersected: it answers true only when `inner` lies wholly inside
  `outer`, which is what an annotation marquee wants — brushing selection is a
  different gesture. Two rects that merely overlap got `false` from a function
  whose name promised the opposite, so a consumer reading the name got it
  backwards.
  
  Breaking: the old name is gone rather than aliased. `fracContains` is unchanged
  and still takes a point.
- 8f9b790: `<LabSwitcher>` turns a lab's title into the way to reach the project's other
  labs. A project grows a wall, a dashboard, an ingest page, a bench; a tab strip
  beside the title is the layout that stops working first, and every consumer was
  writing its own.
  
  The menu holds real anchors, not a `<select>` and not buttons: these are
  separate documents, so an `href` is what gets middle-click, cmd-click and the
  back button for free. The open page stays in the list and is marked with
  `aria-current` rather than filtered out, so entries do not shift position as you
  move between pages. Given fewer than two pages it renders a plain heading — a
  disclosure arrow promising a menu of the page you are already on is worse than
  no control.
  
  `<LabShell>` takes `pages` and `path` and wires the same control into its own
  title; without `pages` its title is unchanged. `currentPage(path, pages)` is
  exported for consumers that mark the open page somewhere else — it matches on
  the end of the path, so a query string, a trailing slash or a leftover `.html`
  cannot lose it.
- acaa71d: A `{ px }` stroke width survives SVG export as `vector-effect="non-scaling-stroke"`.
  
  `{ px }` means "this thickness once rendered, whatever the view is doing".
  Serializing wrote its number as a plain `stroke-width`, which is a world-unit
  length — so a hairline exported from a zoomed-out view came back a slab, and a
  document had no way to say what the kit's own type says. SVG has the attribute
  for exactly this, and it needs no accumulated transform scale to resolve
  against.
  
  `SvgStroke.width` is now `number | { px: number }`, matching `Stroke.width`.
  Parsing reads `vector-effect="non-scaling-stroke"` off the element rather than
  the cascade, because SVG does not inherit it — a `<g>` carrying it does not
  hand it to its children.
- Updated dependencies [9ce6f00]
- Updated dependencies [d80a7eb]
- Updated dependencies [6f876a7]
- Updated dependencies [ed400a3]
- Updated dependencies [fc00dae]
- Updated dependencies [730da55]
- Updated dependencies [60ba9d9]
- Updated dependencies [5732951]
- Updated dependencies [2ff4824]
- Updated dependencies [3d89141]
- Updated dependencies [4a128c4]
- Updated dependencies [aee9d92]
- Updated dependencies [c067221]
- Updated dependencies [26d40bf]
- Updated dependencies [b8d2940]
- Updated dependencies [acaa71d]
- Updated dependencies [b5e2cd9]
- Updated dependencies [89276ee]
- Updated dependencies [36950d8]
- Updated dependencies [4f8c6b2]
- Updated dependencies [4d48493]
- Updated dependencies [1240956]
  - @weasel-js/core@1.4.4
  - @weasel-js/theme@1.4.4
  - @weasel-js/ui@1.4.4
  - @weasel-js/svg@1.4.4
  - @weasel-js/loupe@1.4.4

## 1.4.3

### Patch Changes

- 24896fb: `ComboBox` takes `width='fit'`, and labkit's zoom field stops pinning pixels.
  
  `Select` and `NumberField` already had it; `ComboBox`'s text input did not, so
  the only way to keep one out of a toolbar's slack was a pixel width from the
  consumer's own stylesheet. At `fit` the input measures a hidden stack of every
  option label — the same mechanism `Select` uses — so the field is wide enough
  for whichever option is chosen and takes no more of the row than that.
  
  labkit's `ZoomControl` states `--wzl-number-field-width: 6ch` instead of pinning
  its field at 62px. Measured in a browser: "800%" is 33px against the 35px a 5ch
  box gives, which is no margin at all in another UI font, and 6ch also holds the
  "1600%" a consumer raising `max` can reach.
- ddb6ef3: An instrument's `serialize` / `deserialize` actually run.
  
  `LabStore.registerSerializers` had no callers, so the map stayed empty: an
  instrument whose state is a `Map`, a `Set`, or anything else JSON drops lost it
  on reload, on snapshot save and on snapshot load, silently and with no error.
  Late registration could never have fixed it either — the store hydrates as it is
  built, which is before any provider mounts.
  
  `createLabStore` takes them as `serializers`, and `<Lab>` collects them off its
  `instruments`, which is the only place that knows both. `registerSerializers` is
  gone with the hole it left; `LabStore` is now the plain store type.
  
  `deserialize` is handed the config the state was saved against — a trial's own
  on reload, the snapshot's on load — matching what `Instrument.deserialize`
  already declared and never received.
- f8a1d3a: An instrument's config can nest. `f.group({ … })` is a branch:
  `grid: f.group({ size: f.number(20) })` puts the value at `config.grid.size`
  and addresses it as `'grid.size'`. Groups nest arbitrarily and chain
  `.label()`, `.describe()`, `.section()` and `.showIf()`, which hides the whole
  subtree. `.section()` is unchanged — a heading over sibling rows that leaves
  their paths alone.
  
  `resolveConfigSchema` emits a nested `PrefGroup` whose dotted paths *are* the
  config paths, which is what weasel-ui's `PrefsForm` already walks, so both
  renderers address a schema identically. `ControlPanel` renders a nested group
  as a `PropertyGroup` under its own heading; fold state keys stay bare labels at
  the root, so stored folds still match.
  
  Writes go through a path write that copies the spine and leaves untouched
  branches at their old identity. `onConfigChange` receives a `nextConfig` built
  the same way, so a nested change arrives with its sibling branch intact.
  
  A config stored before its schema grew a branch loads: `createLabStore` takes
  `configDefaults` and deep-fills every hydrated trial and saved snapshot before
  deserialization, so an instrument's `deserialize` always sees a complete
  config. Filling is idempotent, never rewrites storage on its own, and keeps
  keys the schema no longer names. It makes an old config load; it cannot move a
  value, so an author renaming `gridSize` to `grid.size` keeps the old key and
  gets the new one at its default. A per-instrument `migrateConfig` is the
  separate piece that would close that.
  
  `seedConfig` uses the same merge, which fixes `addTrial({ config })` and Reset
  replacing a whole branch when the seed named one leaf of it.
  
  The config setters take a path now: `ControlPanelProps.setConfig` and
  `RenderContext.setConfig` are `(path: string, value: unknown)`,
  `updateTrialConfig` lost its phantom generic, and `SectionSpec` gained a
  required `at` naming the group that owns it.
  
  A group's `.describe()` reaches `PrefsForm` but not `ControlPanel`, which has
  nowhere to put it.
- 696e506: **Breaking:** `@weasel-js/labkit` no longer ships its own copy of
  `@weasel-js/core`. Install core alongside it, at the matching version:
  
  ```bash
  npm i @weasel-js/labkit @weasel-js/core
  ```
  
  Core is now an exact `peerDependency`, and labkit's `dist` imports it rather
  than inlining it. npm reports a version mismatch at install time instead of
  nesting a second copy.
  
  The second copy was the problem. Core keeps its content handlers, paint kinds,
  shape painters, markers and program registry in module globals, so two copies
  are two sets of registries: an app using labkit *and* core registered a face or
  a paint kind into one and read the other, and got a blank canvas with no
  diagnostic beyond `layoutRuns`' duplication warning. The same failure
  `@weasel-js/svg` and `@weasel-js/font` were peered to close, reached by another
  route.
  
  labkit's other weasel siblings — `ui`, `loupe`, `svg`, `theme` — are still
  bundled; only core changes. Removing it also drops what it pulled in behind it,
  taking labkit's JS from 1.99 MB to 0.97 MB.
- 8b7ee84: Overlays portal into the nearest themed ancestor instead of `document.body`.
  
  Every overlay this package portals — `Select`'s and `ComboBox`'s popovers,
  `Dialog`, `Callout`, `Tooltip` — used to mount on `document.body`. That is
  outside the element `applyTheme` / `<ThemeProvider>` stamps, so every `--wzl-*`
  the overlay read resolved to the empty string and the panel fell back to browser
  defaults: a light box with unreadable text in a dark app.
  
  Each of them now mounts inside the nearest ancestor of its own position
  carrying `data-wzl-theme` / `data-wzl-mode`, so it resolves the same tokens as
  the control it belongs to. **This is a behavior change**: an overlay's DOM
  position moves from the body into the app's tree. Anything reading the document
  for overlay content by walking down from `document.body` will find it one place
  deeper; anything using the `data-weasel-overlay` marker is unaffected.
  
  Two ways to override it. `portalContainer` on any of the five components names
  an element for that overlay alone, and `null` sends it back to
  `document.body`. `<OverlayPortalProvider container={…}>` sets it for a whole
  subtree. A styling root below the themed element can claim the overlays instead
  by carrying `data-wzl-portal-host` — which is how labkit's `.lk-root`, whose
  element defaults the themed wrapper above it does not have, now gets them. The
  per-call-site container the labkit export panel was passing is gone.
- 5a74393: A schema can say a section opens folded: `.section('Advanced', { collapsed: true })`.
  
  The fold itself already worked and already persisted per trial; what a schema
  could not do was start a section closed, which is what an "Advanced" heading
  full of knobs nobody opens on the first run wants. Say `collapsed` on any one
  leaf under the heading — the section it names takes it, and the rest of the
  leaves keep saying `.section('Advanced')`.
  
  A section that declares how it opens is foldable on its own, with no
  `collapse` / `collapsed` / `onCollapse` on the panel. A fold the reader has
  since toggled still wins, so a lab that remembers a trial's sections is
  unaffected.
  
  `NodeOptions.section` is now `{ label, collapsed? }` rather than a bare string.
  The builder's `.section()` is the way this is written; a schema that reaches
  into `options.section` directly reads `.label`.
- Updated dependencies [2de5a37]
- Updated dependencies [10e1ab6]
- Updated dependencies [24896fb]
- Updated dependencies [eb0d6ce]
- Updated dependencies [75969f6]
- Updated dependencies [0d40f94]
- Updated dependencies [713f98a]
- Updated dependencies [85f4a21]
- Updated dependencies [8b7ee84]
- Updated dependencies [4bb0341]
- Updated dependencies [e0d5580]
- Updated dependencies [591ef38]
- Updated dependencies [edf99d5]
- Updated dependencies [2723cc7]
- Updated dependencies [0ca0aca]
- Updated dependencies [af6234c]
- Updated dependencies [3583ca3]
- Updated dependencies [fc16cac]
- Updated dependencies [6d4bbeb]
- Updated dependencies [995fde2]
- Updated dependencies [4f45bd0]
- Updated dependencies [6e4fb4d]
- Updated dependencies [b0fba6a]
  - @weasel-js/core@1.4.3
  - @weasel-js/ui@1.4.3
  - @weasel-js/svg@1.4.3
  - @weasel-js/loupe@1.4.3
  - @weasel-js/theme@1.4.3

## 1.4.2

### Patch Changes

- 8819237: Add `<Disclosure>`, and sit the lab header's controls on the title's baseline.
  
  **`Disclosure`** is the twisty on a collapsible section: a triangle that turns
  as it opens. It holds no state and renders no children — the consumer owns both,
  and `aria-expanded` ties the control to them. `DisclosureRow` puts one beside a
  row of content.
  
  It settles three things every hand-rolled twisty gets wrong. The mark is drawn
  rather than typed, because `--wzl-font-ui` carries no ▸/▾ and a text glyph falls
  back to whatever the system offers at whatever size that font renders it —
  around 6px against 13px body text. The hit target is at least 20px and grows
  with the mark, rather than being the mark's size. And it sits outside the row's
  label rather than inside it, so clicking to expand does not actuate the label's
  own control.
  
  Like `DragHandleGlyph`, it stays out of the icon register: that register is
  outline strokes at a fixed weight, and `icons/base.mjs` rejects a solid triangle
  in it by name.
  
  **The lab header** aligned its controls to the center of the row, so every
  control label sat off the title's baseline — 5px, for the `Add trial` button.
  The header and its actions row now align on the baseline. The button needed one
  more thing: a flex container reports its *first* item's baseline, and the
  leading `<svg>` icon has none, so the button handed the header a baseline
  synthesized from the icon's bottom edge. It aligns on the baseline internally
  now, with the icon keeping its own centering through `align-self`.
- bfb0595: Run the last four drags in the kit on `openPointerSession`. Capture, pointer identity, teardown and recovery from a release that never arrives are now decided in one place for every pointerdown-to-pointerup lifecycle in the kit.
  
  Fix a drag that silently dropped its commit. `openPointerSession` treated `lostpointercapture` as the end of the gesture, and Chrome releases capture implicitly a beat *before* it delivers `pointerup` — so a release already on its way arrived after the session had torn down its listeners, and the gesture ended as a cancel instead of a commit. Roughly three drags in four were lost this way in one measured consumer. Losing capture now ends a session only once the origin has left the document, which is the case the rule was written for: the session listens on the document, so capture is what retargets events, not what delivers them.
  
  The gesture dispatcher opens a session per held pointer instead of tracking pointers itself. Two behavior changes come with that: a drag released outside the canvas now ends, where before only pointer capture made that work; and a fresh press on a pointer still believed held cancels the stale gesture rather than committing it at the new press's coordinates, since where it actually ended is unknown.
  
  Two small breaking changes. `ThresholdDragOptions.onCancel` now fires only when a gesture ends without a release — a release below the threshold calls the new `onClick`. And in labkit, `useDragDrop`'s `startDrag` and `Palette`'s `onDragStart` take the React pointerdown event in place of a `Point`; a cancelled palette drag now drops nothing, where before it had no cancel path at all.
  
  `startThresholdDrag` also takes an `origin` element, for a list whose grabbed row unmounts mid-drag and drops capture with it. `useReorderDragList` uses it and no longer carries its own copy of the threshold logic.
- 68556f5: Let a `LayerStack` have no palette, and let a `LayerList` nest.
  
  **`LayerStack`** required `kind` on every item plus `paletteKinds` and `onAdd`
  on the stack, so a list whose items have no kind and nowhere to add from had to
  pass three stubs to get a drag-reorderable set of expandable cards. All three
  are optional now, as are `onRemove` and `onPrimaryChange`:
  
  - An item names itself with `label` when it has no `kind`.
  - The head row renders only when there is a title or a palette to put in it.
    Without `onAdd` there is no palette, whatever `paletteKinds` says.
  - No `onRemove`, no ✕. No `onPrimaryChange`, no select — a `primaryValue` with
    no handler would have been a control the user could not change.
  - The empty state stops pointing at a palette that is not there, and
    `emptyLabel` overrides it.
  
  **`LayerList`** took a flat array, so a nested set of layers had to be
  rebuilt as a recursive component outside the kit. `layers` is now
  `LayerTreeNode[]` — a `LayerDescriptor` with optional `children` — and a node
  with children renders an expandable subtree behind `<Disclosure>`. A plain
  `LayerDescriptor[]` still type-checks and renders exactly as before, twisty
  column included: it appears only once some node in the tree has children.
  
  Reordering is scoped to siblings. A drag moves a row within its own parent's
  child list and never reparents it; `onReorder` still hands back the whole tree,
  with only that group's order changed. Collapse is uncontrolled by default,
  seeded from each node's `defaultCollapsed`; pass `collapsedIds` to own it, and
  `onCollapsedChange` fires either way.
- b1cddc6: Property panels take `density` and `align`, and `layout` reaches every row kind.
  
  Three things a consumer could not do from outside `Properties.module.css`.
  
  **Spacing was four hard-coded numbers** — the list's row gap, the group's
  padding, the group title's margin, the panel's padding — none of which read a
  custom property. Every metric in the family now does: `--wzl-prop-row-gap`,
  `--wzl-prop-column-gap`, `--wzl-prop-panel-pad`, `--wzl-prop-panel-title-gap`,
  `--wzl-prop-group-pad`, `--wzl-prop-group-title-gap`,
  `--wzl-prop-subpanel-row-gap`, `--wzl-prop-field-h`, `--wzl-prop-field-pad-x`.
  A `density` of `'tight' | 'normal' | 'roomy'` on `PropertyPanel`,
  `PropertyList`, `PropertyGroup`, `Subpanel` or `PropertyRow` sets them as a
  bundle. Both props inherit, so the nearest container that states one wins and an
  inner group can differ from the panel around it.
  
  **A color row centered its label and swatch and could not be told otherwise**,
  so a palette panel — a column of swatches read as a group — had no way to line
  them up. `align` takes `'start' | 'center' | 'end' | 'baseline'`; `baseline`
  sits each swatch on its label's first-line baseline, which holds when labels
  wrap to different heights. Left unset, a color row keeps sinking its content to
  the row's bottom edge, so an alpha track stays level with the taller row beside
  it.
  
  **`ColorRow` and `CheckboxRow` took no `layout`.** `PropertyRow` gated the
  inline class on the default variant, so a panel asking for one orientation got
  another for two row kinds out of six. `layout` is now unset by default and each
  variant supplies its own — `block` for the default variant, `inline` for color
  and checkbox — so passing it through a whole panel is safe, and `block` on a
  color or checkbox row stacks it. `ControlPanel` forwards `layout` to those two
  rows, and takes `density` and `align` of its own.
  
  `PropertyList` and `PropertyGroup` also take `pack="one-up"`, which gives every
  row the full width, color rows included. `'auto-color'` pairs them two per row
  and there was no way to opt out — which is the packing a palette needs.
  
  Nothing changes for a consumer that passes none of these.
- 68556f5: `SliderRow` gets a live/commit pair, and a `PropertyGroup` can fold away.
  
  **`SliderRow` now takes `onInput` alongside `onChange`** — the pair `<Slider>`
  already spells. `onInput` fires through the drag, `onChange` once it ends, so a
  control whose write is expensive (a re-simulation, a refetch) can say "on
  release". The commit half is the platform's own: a range input fires `input`
  continuously and `change` when the value settles. A typed readout reports to
  both. A row given only `onChange` is unchanged — that one callback stays the
  live write and there is no separate commit.
  
  **`PropertyGroup` collapses.** `collapsible` puts a `<Disclosure>` twisty
  beside the title; `defaultCollapsed` starts it folded and leaves the state with
  the group; `collapsed` + `onCollapsedChange` hand that state to the consumer.
  Folded rows stay mounted and hidden, so a control's local state survives being
  put away.
  
  `ControlPanel` passes it through to a schema's sections. `collapse="closed"`
  folds them all; `collapsed` — a map keyed by section label — plus `onCollapse`
  put the open/closed state somewhere a lab can keep it. A panel that sets
  neither renders exactly as before.
- 68556f5: A trial can be opened on a subject, and `annotations.targets` is told which trial is asking.
  
  `addTrial(name, { config })` writes a seed over the instrument's `defaultConfig()` before `initialState` reads it, so a trial opened on a subject is running that subject from its first frame. The seed is kept on the record, so Reset returns the trial to what it opened on rather than to the bare defaults; a key whose seeded value is `undefined` is left to the default. `addTrial(name)` is unchanged. Without this, `defaultConfig()` was the only hook and takes no arguments, which left a caller smuggling the subject through a module-level slot that `defaultConfig` read and cleared.
  
  `annotations.targets` takes the asking trial as a third argument: `targets(state, config, trial)`, where `trial.id` is the id `useTileId` scopes a surface tile under and `trial.view` is that trial's camera. A declaration is made once per instrument and called once per trial, so a consumer holding per-trial DOM refs previously had to smuggle a trial key through its own instrument state and key a registry by it, and a per-trial camera had to ride in a ref. Both were invisible with one trial open. A two-argument `targets` keeps working.
  
  **`AnnotationTargets` takes a matching required `trial` prop, which breaks any consumer rendering it directly.** Required rather than defaulted from context on purpose: one rule instead of two paths, and a caller that has not thought about which trial it is drawing for gets a type error rather than silently sharing the first trial's targets. Pass the trial the component is drawing for.
  
  `TrialInfo` — `{ id, view }` — is exported, and `RenderContext.trial` is typed from it, so `ctx.trial.id` in `render` and `trial.id` in `targets` are one notion.
- 12054ab: A trial remembers its title and which of its sections are folded.
  
  Both were in-memory only: a retitled trial reverted to its instrument's name on
  reload, and every fold reopened on remount. They now live on the trial record —
  `TrialRecord.title` and `TrialRecord.collapsedSections` — so they persist with
  everything else the lab writes. Both are optional, so a document written before
  this loads unchanged.
  
  `TrialChromeContext` gains `collapsedSections` and `setSectionCollapsed`, the
  pair a contribution reads and writes. A sidebar section is keyed by its
  contribution id; a section inside one — a control panel's property groups — is
  keyed `<contribution id>/<label>`. A section with no entry sits at its own
  `defaultCollapsed`.
  
  Sidebar sections are now controlled rather than holding their own state, and
  the built-in Settings panel's groups fold: it passes `collapsed` and
  `onCollapse` through to `ControlPanel`, which is what puts a twisty beside each
  group heading.
- 68556f5: A trial can be retitled, its title bar has a leading end, and a chrome item's
  `onActivate` is handed the trial's context.
  
  `TrialChromeContext` gains `title` and `setTitle`. A trial's bar reads its
  instrument's name until something calls `setTitle`, so a lab running one
  instrument over many subjects can say which subject a trial holds instead of
  repeating the instrument's name down the column; `setTitle(null)` puts the name
  back.
  
  The title bar now honors `end` the way the toolbar does. A `titlebar`
  contribution that sets `end` joins the actions cluster — clone, reset, snapshot,
  close — and one that leaves it unset leads the bar, ahead of the title.
  `TitleBarRegion` takes a `placement` of `'lead'` or `'actions'` and renders the
  contributions belonging to that end. All four built-ins set `end`, so nothing
  moves.
  
  `ToolbarItem.onActivate` and `ViewportControl.onActivate` receive the trial's
  `TrialChromeContext`. A contribution declared through `Lab.chrome` can now call
  `ctx.saveSnapshot()` directly, so re-declaring a suppressed built-in in another
  group no longer means dropping to `render` and hand-rolling a button outside the
  chrome's layout. A zero-argument handler keeps working untouched.
- Updated dependencies [8819237]
- Updated dependencies [bfb0595]
- Updated dependencies [68556f5]
- Updated dependencies [68556f5]
- Updated dependencies [b1cddc6]
- Updated dependencies [352f938]
- Updated dependencies [3b07b13]
- Updated dependencies [68556f5]
- Updated dependencies [8e9eb1d]
  - @weasel-js/ui@1.4.2
  - @weasel-js/core@1.4.2
  - @weasel-js/loupe@1.4.2
  - @weasel-js/svg@1.4.2
  - @weasel-js/theme@1.4.2

## 1.4.1

### Patch Changes

- a2c5318: Bundle labkit's `.d.ts` from its dependencies' built declarations instead of re-deriving them from source.
  
  The old pipeline aliased every weasel specifier to `src/`, so emitting labkit's types pulled the entire engine — around 1,900 files — into one TypeScript program. It needed just under 4GB of heap, which is above a CI runner's default, and had been failing the build. It now reads each dependency's `exports` `types` entry, the same tier ordering the JS build already relies on, and needs a little under 2GB. The emitted declarations are unchanged: same 749 exported symbols across the same 15 entry points, with identical type strings.
  
  Building labkit alone in a tree whose other packages have never been built now fails with the tiers to run rather than an unresolved import.
- 0b0f13f: Put every drag in the kit on one pointer lifecycle, and recover the releases the DOM does not deliver.
  
  Fourteen pointerdown-to-pointerup lifecycles each answered capture, pointer identity, teardown and lost-pointer recovery for themselves. They now run on `openPointerSession`: `Slider`, `BandEditor`, `Timeline`'s `Lane` and `Ruler`, `LayeredCurveEditor`, `ResizeHandle`, `useReorderDragList`, `MinimapCanvas`, labkit's `LayerList`, `usePanZoom`, `useOrbit` and `FloatingPanel`. A drag released over another window, or whose element unmounts mid-gesture, now ends instead of hanging in flight.
  
  A third recovery rule joins the two that shipped with the primitive: a fresh press on a pointer still believed held reports `'superseded'`, because the release landed somewhere that never told us and the pointer never came back for the missed-release rule to see. Without it a stale session steers the next press. `useGestureDispatcher` applies the same rule to its own multi-pointer lifecycle.
  
  Breaking: hooks that drove their drag through returned React props no longer return them, because the session owns the gesture from the press.
  
  - `useReorderDragList`'s `containerProps` is `{ ref }` only; `onPointerMove` / `onPointerUp` / `onPointerCancel` are gone. It gains `onPress(id, mods)` — a press released without engaging a drag, fired for locked rows too, with the modifiers held at press. That is the click-vs-drag decision consumers previously had to reconstruct by sampling drag state before forwarding the pointerup, which no longer works now that the session ends first.
  - labkit's `PanZoomHandlers` and `OrbitHandlers` lose `onPointerMove` / `onPointerUp`. `usePanZoom` gains `onTap` for the same reason.
  
  The five `@weasel-js/ui` drag surfaces pass `capture: false` deliberately and now assert it: capture retargets `pointerup` to the capture element and kills the click on consumer-rendered content inside a slider thumb, a band body, or curve-editor chrome.
- Updated dependencies [dcef92c]
- Updated dependencies [73039aa]
- Updated dependencies [b91a8dd]
- Updated dependencies [caad52f]
- Updated dependencies [47c75ca]
- Updated dependencies [0b0f13f]
- Updated dependencies [00af9ac]
- Updated dependencies [9b9224c]
  - @weasel-js/core@1.4.1
  - @weasel-js/ui@1.4.1
  - @weasel-js/theme@1.4.1
  - @weasel-js/loupe@1.4.1
  - @weasel-js/svg@1.4.1

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
- 762f947: Re-export the icon set through `@weasel-js/labkit/weasel-ui`, and give the
  three workspace-layout glyphs named components.
  
  A lab that depends only on `@weasel-js/labkit` could not draw a kit icon at
  all: the passthrough carried every other primitive but not `Icon`,
  `ICON_PATHS` or their types, so the only way in was a direct `@weasel-js/ui`
  dependency — the thing the passthrough exists to avoid.
  
  `LayoutRowsIcon`, `LayoutColumnsIcon` and `LayoutGridIcon` join the named
  glyph components in `@weasel-js/ui`.
- 7aa92a8: Draw the lab's color mode as icons instead of words.
  
  `@weasel-js/ui` gains three glyphs — `modeLight` (a rayed sun), `modeDark` (a
  crescent) and `modeAuto` (a four-pointed sparkle) — with `ModeLightIcon`,
  `ModeDarkIcon` and `ModeAutoIcon` beside the other named components.
  
  labkit's header bar becomes `size="sm" variant="flat"`, the same treatment the
  stroke cap / join / align rows use, with each segment holding a 14px glyph.
  The words move to `ariaLabel`, so the control is still a radiogroup announcing
  Auto / Light / Dark and its keyboard behaviour is unchanged.
- a397fa6: Scope a surface tile's id to the trial it is registered in, so two trials of one
  instrument no longer share a rect.
  
  A surface's tile namespace is one lab-wide map, but an instrument names its
  regions once and every trial of it declares those same names. The second trial
  to mount took the first one's entry — its rect, its ResizeObserver registration
  and its painter — so the first was never told it had moved again, and kept the
  box it was measured at while it was the only trial open: a 666px-wide overlay
  standing over a 476px pane, swallowing input meant for its neighbour.
  
  `useSurfaceTile` and `AnnotationOverlay` now register under `useTileId(id)`,
  newly exported, which is `<trial>/<id>` inside a trial and `id` alone outside
  one. A frame's `rects` are keyed the same way, so a host looking a tile up calls
  `useTileId` for the key rather than the name it registered with.
- 21b0582: Give a trial's sidebar a draggable seam.
  
  `.lk-trial__sidebar` was a stated 320px with nothing between it and the
  instrument, so a lab whose sidebar needed to be wider had no way to say so at
  runtime. The sidebar and the content well are now a two-pane `windease` strip:
  the seam is `stripStrategy`'s own resize affordance, which arrives as a
  `role="separator"` carrying the range it can reach, operable by pointer and by
  arrows / Home / End, and clamped against the content pane's floor rather than
  the sidebar's alone.
  
  The width persists per trial (`TrialRecord.sidebarWidth`), so a dragged sidebar
  survives a reload and a clone inherits it.
  
  `<TrialBody>` is exported for a lab composing its own chrome; `minWidth`,
  `maxWidth` and `contentMinWidth` are its props. Like `<Workspace>`, it measures
  its own box and takes a `viewport` where nothing measures — jsdom, notably.
  
  **`--lk-trial-sidebar-w` no longer does anything.** The width is a number the
  trial holds, not a token the stylesheet reads; a lab that set the variable
  should pass `width` to `<TrialBody>` or let the seam settle it.
- d2f80b1: Give every trial a trial-id scope, and mount a shared drawing surface.
  
  `useTrialState()` threw inside any instrument hosted by a `<Lab>`:
  `<TrialIdProvider>` had one production mount, in `SingletonExperiment`, so the
  documented trial-scoped hook pattern was unreachable from an instrument's
  `render`. `<Trial>` now provides it, outside `<TrialChrome>`, so contributions
  can read trial state too.
  
  `useTiledSurface` had no production provider, so `useSurfaceOptional()` always
  answered null and a registered tile reached nothing — including `Workspace`'s
  own rect invalidation on grid moves, which was written against a surface
  nothing supplied. `<Lab>` mounts one, anchored to `.lk-lab__body`, and defers
  to a surface its host already owns rather than opening a second GL tenancy.
- 1595a52: An instrument can declare regions that accept marks.
  
  `annotations: { targets, meaning? }` on an `Instrument` names the regions and,
  optionally, the vocabulary a mark's status may use. `createAnnotationStore`
  answers everything about the marks on those regions — `query`, `hitTest`,
  `within`, `isStale` — over a weasel scene it treats as the truth rather than a
  copy it keeps in step.
  
  Positions cross the store boundary as fractions of a target's content box, so a
  mark stays on the same feature when the render resolution changes.
  `positionDependsOn` names the config keys a target's positions depend on;
  labkit snapshots them beside each mark and compares them later without knowing
  what any of them mean.
  
  Snapshots from `toJSON()` are JSON-safe and carry their own version, because
  labkit stringifies `record.state` raw and its document migrations never reach
  into a trial's state.
  
  The overlay that renders marks and the tools that draw them are not in this
  release: the store is reachable and testable on its own.
- 5295c34: Draw on a lab's instrument: the `annotations` capability gets its overlay.
  
  An instrument that declares `annotations` now gets a drawing surface on every
  target it names — weasel tools, weasel selection, marks that pan and zoom with
  what they mark — plus a palette (select, freehand, line, arrow, rectangle,
  ellipse, text) and its own tool slot. `useAnnotations()` reaches the store from
  the instrument's render or from a chrome contribution, and re-renders its
  caller as marks change.
  
  The lab's shared surface grew the buffer that makes this possible: one
  `<canvas>` over `.lk-lab__body`, and `SurfaceHandle.registerPainter`, which is
  how a resize of that buffer reaches every tile rather than the one that moved.
  `getContainer()` names the element tile rects are measured against.
  
  A mark is a weasel scene node in a scene of its own per target — a pane's
  hit-test, marquee and paint walk the whole scene they are handed, so one shared
  scene would put a neighbour's marks under the pointer. An annotation's id is
  therefore `<target>/<node>`, and `createAnnotationStore` takes `targets` alone
  plus an optional `restore`; `SerializedAnnotations` carries `scenes`, keyed by
  target. Marks still do not survive a reload — the storage slot is the next arc.
  
  Core adds `ArrowIcon` to the built-in tool glyphs.
- 73052a9: Marks persist, undo takes them back, and a mark can say what it means. Closes
  the `annotations` capability.
  
  `TrialRecord.annotations` is where a trial's marks are kept — written on a
  trailing debounce and flushed on unmount, so the last mark before a close is
  not lost. The field is optional and additive: a document written before this
  change lacks it and needs no migration. An instrument that would rather own its
  marks declares `annotations.storage` with a `load`/`save` pair, and labkit
  never touches its own slot.
  
  Undo is routed to weasel history rather than reimplemented. Each target's marks
  live in their own scene with its own stack, so `AnnotationsApi` grows
  `undo` / `redo` / `canUndo` / `canRedo`, which take back the most recent change
  wherever it was made. Declaring `annotations` now earns the trial's undo and
  redo buttons whether or not the instrument also declares `undo`; a trial
  declaring both takes the marks first.
  
  A `Marks` sidebar panel (`<MarkList>`) lists every mark with its kind, its
  target, an editable title, a status picker and a staleness badge.
  `AnnotationStatus` gains a `color`, which the mark on the canvas follows; a
  mark whose target's declared config keys have moved draws dashed rather than
  hidden, because it still describes something.
- 25f6ee3: Export a lab's picture with its marks on it — new API, and new chrome.
  
  A target declares `base()`, handing over the picture underneath its marks as
  SVG markup, an image `src` or a canvas. labkit cannot rasterize that itself: it
  is the consumer's DOM. A target declaring no base still exports, its marks on
  transparency.
  
  `AnnotationsApi` grows `capture(target, { format, scale })`, resolving to a
  Blob plus its dimensions, and `targets()`, which reports the declared targets.
  The route depends on the base: an SVG one nests beside the marks in a single
  document that rasterizes once at the end, which also makes `format: 'svg'` a
  real vector export. Anything else stacks rasters, the marks drawn offscreen at
  export scale by `renderSceneToPixels` rather than read back off the live
  surface — so a capture neither depends on nor disturbs what is on screen.
  Export resolution follows the target's content box and the scale, not the size
  the pane happens to be on screen.
  
  Declaring `annotations` now earns an Export button in the trial toolbar, opening
  a panel that picks a target, PNG or SVG, and a scale, and then downloads or
  copies. `AnnotationsCapability.onCapture` fires after every export, labkit's own
  chrome included, for a host that wants to file the blob somewhere of its own.
  
  Two smaller additions come with it: `createMarkDrawOne` / `resolveMarkStyle`,
  the single place a mark's colour and stale dash are resolved for both the
  screen and an export, and `markSvgNodes`, which translates a mark's own draw
  commands into `SvgNode`s rather than switching over the mark kinds a second
  time.
  
  labkit gains a dependency on `@weasel-js/svg`. Its build already inlined that
  package by way of `@weasel-js/ui`, so nothing about what ships changes; the
  declaration is what the manifest audit reads.
  
  One caveat for anyone using React Aria overlays inside a lab: they portal to
  `document.body` by default, which is outside the element labkit paints its
  theme tokens onto, and they render unthemed there. The export panel passes the
  lab root as its portal container. Nothing else in labkit does yet.
- f046dfe: Let a host read and set which marks are selected.
  
  This adds API. `AnnotationsApi` grows `selection()` and `setSelection(ids)`,
  in the same `<target>/<node>` ids the rest of the surface uses, merged across
  every target — the question "which mark did the user just click?" had no public
  answer, so a host could draw marks and query them but could not respond to one.
  
  There was nothing to build: the overlay's `<SceneCanvas>` per target already
  runs weasel's own selection, and weasel keeps a canvas's selection on the scene
  rather than in React. The store already holds those scenes, so it reads and
  writes selection directly and the overlay is untouched. Click, marquee, handles
  and undo's selection restore all come along for free.
  
  A selection change already reached `subscribe` for the same reason — a scene
  notifies its listeners on `setSelection`. Its doc comment now says so.
  
  An id naming a target or a mark that is not there is dropped, matching how
  `update`, `setMeta` and `remove` ignore one.
- fa58247: Export `usePanZoom` from `@weasel-js/labkit` and `@weasel-js/labkit/canvas`,
  alongside `UsePanZoomOptions` and `PanZoomHandlers`.
  
  The 2D camera was reachable only by adopting `CanvasStack`, which owns its own
  `<canvas>` elements and layer scheduler — exactly what a lab hosting a foreign
  renderer through `surface` has opted out of. Its 3D peer `useOrbit` was already
  exported standalone, so such a lab got the orbit camera from labkit and had to
  reimplement the pan/zoom one, cursor-anchored wheel zoom and reachable-opening-
  zoom clamp included.
  
  `useOrbit` now also rides the `/canvas` subpath, where the two cameras sit
  together.
- 28894b9: `FloatingPanel` no longer swallows a click on a control that is not a native
  element.
  
  It captured the pointer on pointerdown to drag itself. Capture retargets
  mouseup, so the browser synthesizes no `click` on the child under the cursor —
  and the guard exempting children was an element-name allowlist (`input`,
  `button`, `a`, `select`, `textarea`, `[data-no-drag]`). Anything else in a panel
  was therefore dead to a real mouse while a programmatic `.click()` still worked,
  which is how it hid. A `role="button"` span, a component library's control that
  renders a div, and a canvas were all affected.
  
  The panel now arms on pointerdown and captures only once the pointer has moved
  3px, so a press that does not move is never a drag. The allowlist stays, so
  dragging _from_ a native control still does nothing.
  
  Also documents the styling contract this came in alongside — see "Styling
  labkit from your own stylesheet" in the recipes: classes are `lk-*`, tokens are
  `--wzl-*`, and `var(--lk-…)` silently takes its fallback.
- 4dc5cad: A loupe any lab can turn on
  
  `loupe` joins `canvas`, `layers`, `dragDrop` and `undo` as an instrument
  capability, so declaring one is what gives a trial the magnifier and its
  toolbar switch — suppressible by id like every other built-in.
  
  Two painters, chosen by what the instrument's content is. `loupe: true` on an
  instrument that draws gets the canvas painter: the lens re-runs that
  instrument's own layers through a camera zoomed about the aimed point, so a
  hairline is still a hairline at 30×, and `mode: 'pixel'` enlarges the pixels
  the stack presented instead. `loupe: { render }` gets the DOM painter, for an
  instrument whose content is markup: handed a camera, it draws itself again
  inside a circular clip. Either way the lens takes no pointer events, so the
  pan, the wheel and anything underneath keep working while it is up. A function
  form — `loupe: (config) => …` — is re-read as the config changes, so a setting
  can drive the lens.
  
  The lens follows the pointer while it is on, appears for as long as `Alt` is
  held while it is off, and takes the wheel from pan/zoom to resize its
  magnification. Those are plain listeners for now; `docs/TODO.md` records why,
  and what replaces them.
  
  Supporting surface: `zoomAt` and `centerOn` are exported from
  `@weasel-js/labkit` — the fixed-point zoom `usePanZoom` already ran, and the
  camera that centres a world point in a viewport — so nothing composing a camera
  has to re-derive one. `CanvasStackContext` now also carries the stack's
  `surface`: its element, measured box, layers and presented canvases, which is
  what an overlay needs to re-draw or read back what the stack painted.
  `ToolbarItem` takes `pressed`, rendering `aria-pressed` and a held-down state,
  and `@weasel-js/ui` gains a `loupe` glyph.
- 719c0fe: Rewrite labkit's public documentation. Docs only — no code changes.
  
  The README is the landing page of the published docs site, and it described a
  package that no longer exists: v0.x, the lab/trial/instrument runtime "arriving
  in later plans", and an Installation section telling readers to clone two repos
  side by side and depend on `file:../labkit`. labkit is on the public registry
  and is a workspace package in this monorepo, so both halves sent an adopter
  somewhere that could not work.
  
  It now installs from npm, states the React 19 peer dependency, and covers the
  surfaces it never mentioned: the capability list an instrument declares from,
  annotations, chrome regions and undocking, the `f(...)` config schema, and all
  fifteen subpath exports. The Usage example uses `<Lab>` rather than a shell
  around bare `<div>`s, and the Development section lists the scripts the package
  actually has — `npm run storybook` was not one of them.
  
  Four dead documentation links pointed at `orochi235.github.io/labkit/` and at a
  standalone `orochi235/labkit` repo. The docs site is under
  `orochi235.github.io/weasel/labkit/`, Storybook under
  `orochi235.github.io/weasel/docs/ui/storybook/`, and the design spec is in this
  repo.
  
  RECIPES gains annotations coverage — declaring targets, reading the store,
  export, and keeping marks in your own storage — plus chrome contributions and
  panel undocking. AGENTS gains source maps for both, and its stale rows are
  fixed: it named seven files that had moved or been deleted, and told readers
  design tokens are `--lk-*` when no such property is ever declared.
- 3101f60: `PaletteRegion` and `ViewportRegion` claimed `role="toolbar"` without the
  keyboard contract that role promises — no roving tabindex, every button in the
  tab order. Both now use `useRovingTabIndex`, which takes an orientation: the
  vertical palette walks ArrowUp/ArrowDown and leaves the cross-axis arrows to the
  page, per APG.
- 55b73ab: The Save snapshot button moves from a trial's toolbar to the end of its title
  bar, beside clone and reset. The three are one group of trial-level actions and
  now read as one. `Mod+S` is unchanged — the handler is on the trial element, not
  the region. The Load snapshot picker stays in the toolbar; it is a select, not
  an icon button.
- aaf8bfc: A sidebar section can be torn out into the workspace, and put back.
  
  Every `sidebar` contribution now carries a tear-out control. Undocking moves
  the section out of its trial's sidebar and into the workspace as either a tile
  — a peer of the trials in the same grid, resizable and reorderable like one —
  or a floating panel above the grid. The section says which it wants with
  `undockAs: 'tile' | 'floating'` (default `'tile'`), and a section that only
  makes sense beside its trial opts out with `undockable: false`.
  
  `Workspace` registers windease's `floatingStrategy` alongside `gridStrategy` to
  carry the second target, and takes `panels: readonly PanelDescriptor[]`.
  
  The panel's content is **portalled** out of the trial rather than re-rendered
  beside it: the workspace owns the frame and the host element, the trial owns
  what goes in it. So a torn-out section keeps its place in the trial's React
  tree — its context, its subscriptions and its own component state all survive
  an undock and a dock, and an instrument does not have to make its panels
  free-standing to allow it.
  
  `TrialChromeContext` gains `undockedPanels`, `undockPanel(sectionId, as?)` and
  `dockPanel(sectionId)`, so a consumer can drive this from its own chrome
  instead of the built-in control.
  
  Which panels are out is persisted with the rest of the lab, so it survives a
  reload. That moves the document to **version 3**; `migrateV2toV3` starts the
  field empty and touches nothing else. Closing a trial docks everything it
  owned.
  
  `Workspace`'s node-id list is now kept in a ref keyed on the joined ids rather
  than a `useMemo` over a stand-in key, which drops the two lint suppressions
  that arrangement needed.
- 6f0ba17: Let a labkit instrument declare its own coordinate system for the canvas.
  
  `CanvasCapability.worldSpec` takes an `origin` — a fraction of the viewport, so
  `{x: 0.5, y: 0.5}` means "centred" without knowing the canvas size — and
  `yAxis: 'up' | 'down'`. Omitting it keeps the convention labkit has always had:
  world (0,0) at the element's top-left, y running down.
  
  The spec is resolved against the measured viewport into a `WorldFrame`, and
  every path between world and screen now reads it: `worldToScreen`,
  `screenToWorld`, the new `applyCamera`, `usePanZoom`'s wheel anchor, and the
  drop position in `DragDropRuntime`. This is a bug fix as much as an addition —
  an instrument whose world was not y-down-from-the-top-left previously had to
  layer its own transform on top, and the wheel then anchored on the wrong point
  and drifted by `(1 - ratio) * originPx` every step, with no error.
  
  `CanvasCapability.initialView` also accepts a function of the viewport size.
  The trial's view stays `null` until the canvas is first measured and
  `CanvasStack`'s new `onResize` places it, so an instrument that frames content
  against the viewport no longer needs its own "have I placed this yet" flag.
  
  `RenderContext.trial.visibleLayers` lists the canvas layers currently shown, in
  declaration order — labkit skips a hidden layer's `draw`, so this was
  previously only discoverable by instrumenting every layer.
  
  Clone and Reset move from the trial toolbar to the right edge of the trial
  title bar, beside Close.
  
  `CanvasStackContextValue` gains a required `frame`, and
  `CanvasLayerDescriptor.render` takes it as a third argument.
- a6faf75: Pack property rows two-up, and size their fields to their content
  
  A property panel spent a full row on every leaf and stretched each field to
  whatever width the row had, so a 38-flag lab sidebar scrolled for two screens
  to show four dozen digits. The grid was already there — `PropertyList` and
  `PropertyGroup` have taken `pack="pairs"` since they were written — but only
  `PropertyRow` could opt out of it, so nothing that rendered a schema could use
  it: `ControlPanel` hardcoded `pack="auto-color"`, which spans everything but a
  colour.
  
  `ControlPanel` now takes `pack` and `layout`. It defaults to `pack="pairs"`
  (two controls per row), with `'auto'` for the middle ground — text, sliders and
  segmented toggles keep the full width, everything else pairs — and `'one-up'`
  for what it used to do. A custom `controls` renderer places itself like any
  built-in row and opts out the same way, with `<PropertyRow span>`.
  
  `span` is now on every typed row (`NumberRow`, `TextRow`, `SelectRow`,
  `ToggleRow`, `CheckboxRow`, `ColorRow`, `SliderRow`), not just on the
  `PropertyRow` they are built from.
  
  Fields size to their content rather than to their cell: a number gets 9ch and a
  string 16ch, both capped at the column so a narrow sidebar still fills. Fields
  also state a height (`--wzl-prop-field-height`, 20px) rather than padding to
  one — the display face's line box is half again its font size, so a padded field
  stood 27px tall around 13px of text and trimming the padding could not fix it.
  The row and group gutters came in to match.
  
  Widths, heights and gutters are all overridable:
  `--wzl-prop-number-width`, `--wzl-prop-text-width`, `--wzl-prop-field-height`.
  
  A lab's trial sidebar states its width (`--lk-trial-sidebar-w`, 20rem) instead
  of deriving it from content: an auto-width sidebar is as wide as its widest
  label, so one verbose config key was setting the width of the lab. An inline row
  puts its label on the left edge and its field on the right, so fields of
  different widths still read as one rail down the column, and it keeps its one
  line in a column narrower than it wants: the field yields width to the label
  down to a four-character floor, and the label — which may be a single
  unbreakable name — never yields.
  
  Every property panel is visibly denser for this — WeaselDraw's inspector as
  much as a lab's controls.
- Updated dependencies [eb16573]
- Updated dependencies [72b30cc]
- Updated dependencies [6650d67]
- Updated dependencies [04ea2e8]
- Updated dependencies [b656ebf]
- Updated dependencies [762f947]
- Updated dependencies [7aa92a8]
- Updated dependencies [fea3092]
- Updated dependencies [c64f152]
- Updated dependencies [1214ff5]
- Updated dependencies [5295c34]
- Updated dependencies [2fbf611]
- Updated dependencies [5c3e571]
- Updated dependencies [36b6ee7]
- Updated dependencies [e1838ff]
- Updated dependencies [7a0c568]
- Updated dependencies [1b42b19]
- Updated dependencies [4dc5cad]
- Updated dependencies [0d0c885]
- Updated dependencies [a7fa697]
- Updated dependencies [2272682]
- Updated dependencies [503b56d]
- Updated dependencies [ac2deea]
- Updated dependencies [a6faf75]
- Updated dependencies [23ffb2f]
- Updated dependencies [016851c]
- Updated dependencies [1b9575f]
- Updated dependencies [c9dd37f]
- Updated dependencies [9a000ea]
- Updated dependencies [016851c]
- Updated dependencies [53ffca9]
- Updated dependencies [8ddec11]
- Updated dependencies [6e5f821]
- Updated dependencies [28894b9]
- Updated dependencies [c4ccd0a]
  - @weasel-js/core@1.4.0
  - @weasel-js/theme@1.4.0
  - @weasel-js/ui@1.4.0
  - @weasel-js/loupe@1.4.0
  - @weasel-js/svg@1.4.0

## 1.3.0

### Patch Changes

- a6140e4: Export the drag-and-drop runtime from `@weasel-js/labkit/dragdrop`
  
  The subpath re-exported three types and no values, so the built
  `dist/dragdrop/index.js` was empty and the working runtime sitting beside it was
  published from nowhere. It now also exports `useDragDrop`, `DragOverlay`,
  `Palette` and `DragGhost`, with their prop and result types: `UseDragDropArgs`,
  `UseDragDropResult`, `DragState`, `DragOverlayProps`, `PaletteProps` and
  `DragGhostProps`.
  
  A consumer can now drive a palette-to-canvas drag against its own
  `DragDropCapability` with the same hook and ghost overlay labkit's instruments
  use, instead of reimplementing them. `DragDropCapability`, `DragFeedback` and
  `PaletteItem` still export as before, and the root barrel is untouched — the
  subpath remains the one place this runtime is published.
- 245fbaf: Add `span` to `PropertyRow` for a full-width row
  
  Making a row take the whole width of a `pack="pairs"` list or a `<Subpanel>`
  meant typing the private class name `lk-property-list__span` into `className`
  and hoping it stayed spelled that way. `<PropertyRow span>` now does it.
- 245fbaf: Show a config leaf's description as a tooltip on its control row
  
  A schema leaf could carry `describe('…')` text, but nothing in labkit rendered
  it: `ControlPanel` read only the leaf's name, so the help a lab wrote never
  reached the person using the lab. Every described leaf now gets an ⓘ beside its
  label, and hovering or keyboard-focusing it shows the description in a tooltip.
  Leaves with no description stay bare.
  
  `PropertyRow` takes the same text directly as `description`, as do the typed
  rows built on it (`SliderRow`, `NumberRow`, `CheckboxRow`, `TextRow`,
  `SelectRow`, `ToggleRow`, `ColorRow`), so a hand-built panel gets the same
  affordance without going through a schema.
- c1e567f: Move `LayerStack` from `@weasel-js/labkit` to `@weasel-js/ui`. It is a generic
  drag-reorderable stack of expandable cards — it reads nothing from labkit's
  instrument, config, state, trial or lab layers — and a consumer who wanted it
  had to take labkit and the lab frame it assumes.
  
  It can now be imported from `@weasel-js/ui` directly. **Existing
  `@weasel-js/labkit` imports keep working**, from both the package root and
  `@weasel-js/labkit/ui/layers`: labkit re-exports it, and it bundles weasel-ui
  into its own dist, so this is a re-export rather than a new dependency.
  
  `DragHandleGlyph`, the grip both `LayerStack` and labkit's `LayerList` draw,
  moves with it and is now public from `@weasel-js/ui`.
  
  `LayerStack` also takes a `className` now, appended to its root — the
  supported way to reach it from a consumer stylesheet, since its own class
  names are hashed.
  
  The class names are no longer public. The stylesheet moved from global
  `lk-`-prefixed Less to a CSS module, matching the package it joined, so
  `lk-layer-stack`, `lk-layer-card` and their neighbours no longer exist as
  targetable selectors, and `--lk-layer-card-accent` is now
  `--wzl-layer-stack-accent`, set for you by the `accent` prop on an item. The
  card's `data-testid` drops the `lk-` prefix: `layer-card-<id>`.
  
  Two of the old rules were prefixed with `.lk-root` to outrank labkit's bare
  `button` defaults. Those defaults now sit at zero specificity, so the module's
  own class wins on its own; the stack no longer depends on a labkit ancestor,
  and it restates the border-box reset and the button font and height that
  `.lk-root` used to supply.
- 555f84c: Move the property-panel components from `@weasel-js/labkit` to
  `@weasel-js/ui`. `PropertyPanel`, `PropertyList`, `PropertyRow`, `SliderRow`,
  `NumberRow`, `TextRow`, `SelectRow`, `ToggleRow`, `CheckboxRow`, `ColorRow`,
  `Subpanel`, `PropertyGroup`, `CurveField` and `EffectCard` imported nothing
  from labkit's instrument, config, state, trial or lab layers — they are
  generic form UI, and a consumer who wanted them had to take labkit and its
  lab frame to get them.
  
  They can now be imported from `@weasel-js/ui` directly. **Existing
  `@weasel-js/labkit` imports keep working**: labkit re-exports the whole set,
  and it bundles weasel-ui into its own dist, so this is a re-export rather
  than a new dependency.
  
  The class names are no longer public. The stylesheet moved from global
  `lk-`-prefixed Less to CSS modules, matching the package it joined, so
  `lk-property-panel`, `lk-property-list__span` and their neighbours no longer
  exist as targetable selectors. Code reaching them from its own stylesheet
  should pass `className` instead — `PropertyPanel`, `PropertyList` and
  `PropertyRow` all accept one. For full grid width, a row takes `PropertyRow`'s
  `span` prop, and anything that is not a row goes in `<PropertySpan>`.
  
  `formatNumber` and its helpers consolidated onto weasel-ui's existing
  `format/number`; labkit's duplicate is gone.
- a6140e4: Export `TrialLayout`
  
  `Workspace` types its `layout` and `onLayoutChange` props as `TrialLayout`, but
  the type itself reached no barrel. Persisting a workspace layout and handing it
  back meant recovering the type structurally, as
  `NonNullable<ComponentProps<typeof Workspace>['layout']>`. It is now a named
  type export from the package root.
- 1f67cad: Draw labkit's chrome and the ui components from one type, weight and shape
  scale. Sizes fold onto six ranks, so a 12px label now renders at 11 and a 14px
  one at 13; corners fold onto four radii. `Button`'s `sm` and `md` text sizes
  converge as part of that fold — the two still differ in height and padding.
  
  Three components that were exported but rendered nowhere now appear in the
  default chrome: `FpsMeter` and `ScaleIndicator` in the status bar,
  `ZoomControl` in the viewport controls, replacing the plain zoom readout.
  `StatusBar.Section` takes `end` to push a readout to the far side, mirroring
  `Toolbar.Group`.
  
  The trial's box-shadow no longer derives from the foreground color, so
  elevation reads as elevation rather than as a halo on dark themes, and its
  border clears 3:1 against the workspace in both modes.
  
  `<Toolbar>` claims `role="toolbar"` and implements the APG keyboard contract:
  one button in the tab order, arrows moving focus within, Home and End jumping
  to the ends. It takes an `aria-label`.
  
  Two colors were wrong rather than merely untokenized. The selected toggle in
  `PropertyPanel` drew near-black text on an accent fill at 1.49:1 in dark mode;
  it now uses `--wzl-fg-on-accent`. `LayerList`'s checkbox had no `accent-color`
  and rendered in the OS blue.
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
- fca9bcf: Assemble a trial's chrome from what its instrument declares. A contribution is
  data keyed to a region — `toolbar`, `palette`, `sidebar`, `viewport`, `status` —
  and the regions render whatever the assembled list puts in them. Bundles
  concatenate built-ins, then the instrument's, then the lab's, and a duplicate id
  throws. A lab adds its own with `chrome` and drops a built-in with `suppress`.
  
  An instrument declaring `tools` gets a palette region and its own tool slot; one
  declaring none reads the lab's, which `<Lab tools>` fills. The resolved tool
  reaches the instrument on `RenderContext.trial.activeToolId`.
  
  Breaking: `detectCapabilities`, `CapabilityFlags`, `ToolbarSlot`, `SidebarSlot`,
  `StatusBarSlot`, the matching `Trial*Context` types, `DefaultToolbar`,
  `DefaultSidebar`, `DefaultStatusBar` and `TrialChrome`'s `sidebarExtras` are
  removed. Zoom moves from the trial toolbar to the new viewport region.
- 4f5d111: Declare an instrument's config once, with `f.schema`
  
  An instrument used to declare its config twice: `defaultConfig(): TC` for the
  values and their types, and `configSchema(): ConfigField[]` repeating every key
  as a control with a label, bounds and a second default. Nothing held the two to
  one answer, and `validateConfigSchema` could not catch the drift because it only
  ever saw the schema.
  
  `f.schema` replaces both. It infers `TC`, supplies the defaults, and says how
  each value is edited:
  
  ```ts
  const config = f.schema({
    showGrid: f.boolean(true),
    cellSize: f.number(20).range(5, 80).step(5).label('Grid spacing'),
  })
  
  defineInstrument({ config, ... })   // defaultConfig is synthesized
  type Config = ConfigOf<typeof config>
  ```
  
  This is additive. An instrument written with `defaultConfig` + `configSchema`
  keeps working, and both paths now resolve to one renderer.
  
  **Built on weasel-ui's `PrefLeaf`, not on `ConfigField`.** That vocabulary — the
  one `PrefsForm` renders, and the one core's structurally-identical `ToolPrefLeaf`
  feeds `SelectionPanel` — already carried kinds, bounds, options, labels, groups
  and an open leaf kind. `ConfigField` was a third dialect of it, so it is now
  adapted into `PrefLeaf` rather than extended.
  
  Four ways in, for a lab that needs something the built-in controls do not give:
  
  - `ControlPanel` takes `renderers`, keyed by config path (checked first) or leaf
    kind, matching `PrefsForm.renderers` and `SelectionPanel.renderers`. A path key
    overrides one field; a kind key supplies a control labkit does not ship.
  - `.render()` on a builder node is the colocated form of the same thing.
  - `<Lab configRules>` runs rules over every leaf before labkit's own inference,
    so a lab states a convention once instead of annotating each field. labkit's
    own inference ships as rules in that same vocabulary.
  - `.showIf()` hides a row while the value stays in config, and `.section()`
    groups rows under a heading.
  
  `validateConfigSchema` no longer rejects an unrecognized field type: a lab
  supplies controls for its own kinds through `renderers`, which validation cannot
  see. Key, label and per-kind constraint checks are unchanged. Relatedly,
  `ControlPanel` now renders a labeled placeholder for a kind with no control
  instead of dropping the row silently.
- 3e40669: Rebuild what a lab gets by default.
  
  `ControlPanel` is built on the property rows instead of hand-rolled native
  inputs, so an instrument's config panel is themed and aligned rather than
  showing OS-blue checkboxes against the parchment theme. Same props, same
  schema.
  
  `<Lab>` renders a header: add a trial, and choose the color mode. Both drove
  `LabContext` with no UI at all, so every consumer rebuilt them.
  
  `JobProgress` replaces the ad-hoc job markup in the trial chrome — a real
  progress element that stays indeterminate until the job reports a total,
  with failures and errors distinguished.
  
  A trial paints a raised surface, so it reads as a panel against the workspace
  instead of being separated from it by a hairline.
  
  **`@weasel-js/core` and `@weasel-js/ui` are now declared dependencies.** Both
  were re-exported from published subpaths (`/weasel-canvas`, `/weasel-ui`)
  while sitting in `devDependencies`, so a clean install could not resolve
  them. The consumer smoke test grew a manifest audit that catches this class of
  break for every package, and labkit is now packed and imported by it.
- 511a547: Add `<FloatingPanel>` to `@weasel-js/labkit` — a draggable box that floats over
  its offset parent and snaps to that parent's corners.
  
  Drag it from anywhere that is not a control: `input`, `button`, `a`, `select`,
  `textarea` and any `[data-no-drag]` element pass their pointer through, and a
  drag that does start stops the event reaching a pan/zoom surface underneath.
  `anchor` picks the resting corner, `snapCorners` limits which corners may
  capture it, `inset` sets how far in it sits, and `storageKey` remembers where it
  was left across reloads.
  
  It drives windease's `floatingStrategy` — `layout()` and `reduce()` called as
  pure functions — rather than mounting a windease container, because a lab
  overlay has one item and no zone tree. This raises labkit's `windease` floor to
  `^1.3.0`.
  
  Parent it to the canvas stack's overlay: it positions against its offset parent,
  so nesting it inside another absolutely-positioned overlay child measures that
  child's box instead of the canvas.
- 69ca8c6: `LayerList` and `LayerStack` now draw the same grip. `DragHandleGlyph` moves to
  `primitives/` and is used by both, replacing the `⋮⋮` text `LayerList` carried.
  It stays out of `@weasel-js/ui`'s icon register on purpose: that register is
  outline strokes at a fixed weight, and a grip is filled dots.
  
  The grip's grab target is padded and the padding cancelled by an equal negative
  margin, so it is comfortable to hit without drawing anything larger than the
  dots or widening the row.
  
  A small `Button`'s label drops to `--wzl-font-size-sm`. It had converged with
  medium's at 13px, which sat top-heavy against a small button's 12px icon and
  20px box.
- 8abb451: Add `<Legend>` to `@weasel-js/labkit` — a color key for labeling what a lab
  draws on its canvas.
  
  An entry is `{ key, label, color, mark? }`. `mark` picks the swatch shape so the
  key looks like the thing it names: `line` (default), `dash`, `dot` or `band`.
  The color rides a `--lk-legend-ink` custom property, which lets one rule set
  paint all four shapes from the same value.
  
  Presentational only — no handlers, no state, no hover behavior. Swatches are
  `aria-hidden`, leaving the label to carry the meaning.
- 9c84cdf: Add a `titlebar` region, and move the trial's close button into it. The close
  button stays a suppressible contribution rather than becoming markup baked into
  the title bar, so `suppress: ['close']` still works and a consumer can put its
  own control up there. `TitleBarRegion` is exported alongside the other five.
  
  Panels no longer inset themselves. `.lk-sidebar-section__body` was insetting a
  panel and then `.lk-control-panel` and `.lk-layer-list` each inset it again,
  which put the first control 16px into a 161px-wide sidebar. The section body is
  now the only gutter, and it is tighter.
  
  The layer list's drag grip was inheriting the `:where(button)` element default,
  so a glyph rendered in a 37×24 box with a border, an elevated fill and a
  backdrop blur. It is now the glyph.
  
  The trial title bar's bottom border moves from `--wzl-line-subtle` to
  `--wzl-border`, matching the toolbar directly below it — at the subtle value it
  was effectively invisible in light mode.
  
  Save-snapshot moves from the trial group to the history group, beside undo and
  redo.
- d9f110e: Stop every frame loop while nothing can see it
  
  New public hook `useVisibleRaf` in `@weasel-js/core` owns the question of
  whether a frame may run: nothing runs while `document.hidden`, and a loop that
  names an element also stops while that element is outside the viewport. A
  request made while suspended is held rather than dropped and re-armed on
  resume, so a loop never polls visibility or needs restarting by hand.
  
  Ten loops now run behind it — `useFrameLoop`, `useAnimator`, `useSimulation`,
  `useDecayLoop`, `useTextEdit`'s overlay follow, `CursorCoordsHud`'s FPS
  counter, `Badge`'s crawl, and labkit's `FpsMeter`, `useTiledSurface` and
  `useLayerScheduler`. Only `useFrameLoop` consulted `document.hidden` before;
  the rest ran on any page left open. `useLayerScheduler` looked safe and wasn't:
  it paints only dirty layers, but a hidden tab still commits React updates and
  its view/size effect marks every layer dirty.
  
  Loops measuring elapsed time rebase their clock through the new `onResume`
  option, so an hour spent hidden does not arrive as one hour-long frame — an FPS
  meter reporting a rate nobody achieved, a tween jumping to its end value on
  return. `dangerouslyRunWhenHidden` opts a loop out for offscreen recording or
  export; nothing in the tree sets it.
  
  `npm run check:frame-loops` fails the build on a bare `requestAnimationFrame`
  in kit source, and runs in CI.
- 20097e6: Declare `sideEffects` on the five packages that were missing it, so bundlers
  can tree-shake unused exports instead of assuming every module does work at
  import time.
  
  `gestures`, `history`, `modes`, and `hud` are `false` — none of them touch a
  global or run anything at module scope. `labkit` is `["*.css"]`, matching
  `ui` and `theme`: its JS is side-effect-free, but a blanket `false` lets a
  bundler drop the `@weasel-js/labkit/styles.css` import a consumer wrote by
  hand, and the page then renders unstyled with no error anywhere.
- c2d3906: Never clamp a canvas's opening zoom out of reach
  
  An instrument declaring `initialView.zoom` far outside `usePanZoom`'s default
  `[0.1, 32]` range collapsed on the first wheel event and could not zoom back:
  the clamp rewrote the opening zoom to whichever bound it crossed, and pan was
  rescaled by the same ratio, so the canvas appeared to go blank on one twitch.
  
  `usePanZoom` now widens its effective range to always admit the zoom the
  canvas opened at, for the life of that canvas — an explicit `maxZoom` below
  the opening zoom no longer wins. `CanvasStack` and `CanvasCapability` (an
  instrument's `canvas` config) both gain optional `minZoom` / `maxZoom` props
  so an instrument can also widen the range up front instead of relying on the
  invariant to save it.
- Updated dependencies [c1e567f]
- Updated dependencies [555f84c]
- Updated dependencies [52c7b2a]
- Updated dependencies [3386d64]
- Updated dependencies [ffafb7d]
- Updated dependencies [ba8b139]
- Updated dependencies [3fb3a46]
- Updated dependencies [67bcb05]
- Updated dependencies [47cbb08]
- Updated dependencies [f43e9c2]
- Updated dependencies [bb27e83]
- Updated dependencies [6a33c3f]
- Updated dependencies [c24e7de]
- Updated dependencies [ce82f4a]
- Updated dependencies [be697dc]
- Updated dependencies [e909a3b]
- Updated dependencies [26bbdcf]
- Updated dependencies [546f67d]
- Updated dependencies [3fb3a46]
- Updated dependencies [ccd51cc]
- Updated dependencies [1f67cad]
- Updated dependencies [0769eea]
- Updated dependencies [c534ff5]
- Updated dependencies [69ca8c6]
- Updated dependencies [3fb3a46]
- Updated dependencies [d9f110e]
- Updated dependencies [0dd35a1]
- Updated dependencies [1a0bea3]
- Updated dependencies [9d95836]
- Updated dependencies [62a3c46]
- Updated dependencies [5f6c28e]
- Updated dependencies [3cd1ee8]
- Updated dependencies [2ea772f]
- Updated dependencies [f77bd95]
- Updated dependencies [2ea772f]
- Updated dependencies [aba8d91]
- Updated dependencies [2ea772f]
- Updated dependencies [3386d64]
- Updated dependencies [68d2651]
- Updated dependencies [3386d64]
- Updated dependencies [c6c499d]
- Updated dependencies [4f1ef0b]
- Updated dependencies [0114abf]
- Updated dependencies [50bc909]
- Updated dependencies [6a06f6d]
- Updated dependencies [a37ee0b]
- Updated dependencies [611b30e]
- Updated dependencies [9ad8cb2]
- Updated dependencies [c1b8511]
- Updated dependencies [f918a87]
- Updated dependencies [d793d3c]
- Updated dependencies [3386d64]
- Updated dependencies [ce2b5c7]
- Updated dependencies [2ea772f]
- Updated dependencies [3fb3a46]
- Updated dependencies [84db1f6]
- Updated dependencies [3386d64]
- Updated dependencies [7a746df]
- Updated dependencies [4f19274]
- Updated dependencies [94f2446]
- Updated dependencies [07fd2de]
- Updated dependencies [81213fc]
- Updated dependencies [2f225d7]
- Updated dependencies [68069dc]
- Updated dependencies [5d0ff9c]
- Updated dependencies [c1b8511]
- Updated dependencies [546f67d]
- Updated dependencies [c2ffa49]
- Updated dependencies [4c097ef]
- Updated dependencies [2b86e00]
- Updated dependencies [d933a89]
- Updated dependencies [bca99e3]
- Updated dependencies [5923c8b]
- Updated dependencies [2ea772f]
- Updated dependencies [2ea772f]
- Updated dependencies [3fb3a46]
  - @weasel-js/ui@1.3.0
  - @weasel-js/core@1.3.0
  - @weasel-js/theme@1.3.0

## 1.2.0

### Minor Changes

- 659f8b2: A lab can drive a renderer labkit does not own

  `CanvasStack` paints into a 2D context and schedules its own layers, so a
  three.js viewer — which brings its own `WebGLRenderer`, its own context and its
  own render loop — had nowhere to go. Five additions, each of which two separate
  labs had already hand-written.

  **`useTiledSurface`** publishes every tile's rect, marks tiles dirty, delivers
  DPR and container size, and coalesces a burst of invalidations into one
  `onFrame`. The consumer keeps the GL: `preserveDrawingBuffer`, the scissor loop
  and the scene graph stay outside the package, because a scheduler that knew about
  them would stop working for a shared 2D surface. `onFrame` carries every tile's
  rect rather than only the dirty ones, since a scissored draw has to know where it
  is drawing relative to a surface that may have resized under it.

  The registry's unit is a **rect**, not a trial. A trial holding a drawn pane
  beside an undrawn one registers one; a trial with nothing to draw registers none.

  **A tile that only moves reports nothing to a `ResizeObserver`**, so `Workspace`
  now invalidates rects off the grid's own `node.placementChanged`. Only labkit can
  see that a tile moved, which left hosts polling until the rects held still.

  **`toDeviceRect`** flips a DOM rect to a GL viewport's bottom-left origin and
  snaps both edges to the device-pixel grid. Unsnapped, a tile and its neighbour
  round apart and strand a hairline column between them.

  **A trial's `view` is now opaque to labkit.** It was `{ zoom, pan }`, and it is
  the only camera state labkit persists, restores on Reset and shows in the
  sidebar — so a 3D lab kept a parallel view in a ref and forfeited all three.
  `TrialRecord` takes a view type parameter, and labkit persists the value without
  reading into it. Nothing written against the 2D view changes; `as2DView` narrows
  for the parts that are inherently 2D, and `RenderContext.trial` gains `view` and
  `setView` beside the existing `zoom` / `setZoom`.

  **`TrialStatusBarContext.zoom` is now `number | null`.** The default status bar
  omits the zoom section rather than reporting 100% for a view that has no zoom.
  A custom `statusBar` slot reading `ctx.zoom` must handle null.

  **`useOrbit`** is the 3D peer of `usePanZoom`: drag to turn, wheel or pinch to
  dolly, double-click to go home. Trigonometry only — it imports no renderer, and
  produces a trial view rather than a matrix.

  **A `job` capability** for work too slow to do during a render. The runtime
  starts it, aborts on unmount and on a `key` change, discards results from a
  superseded run, counts progress, and renders a readout and a cancel control into
  the trial chrome. Per-item failure is a first-class event rather than a thrown
  error, because a run with two failed items is a partial success and its other
  items are worth showing.

  Two new subpaths: `@weasel-js/labkit/surface` and `@weasel-js/labkit/job`.

  <!-- bump-approved: minor: Mike — new public API in labkit (useTiledSurface, useOrbit, the job capability, and the surface/ and job/ subpaths), plus a nullable TrialStatusBarContext.zoom; called explicitly in conversation on 2026-08-23: "next version will be 1.2" -->

### Patch Changes

- 2627cde: Fix a hook-order defect in the Badge effects and several stale-closure bugs,
  found by turning on a correctness lint baseline.

  Six Badge effects (`Aqua`, `Bevel`, `Bevel2`, `Metal`, `Sheen`, `Woodgrain`)
  called `useId` after an early return keyed on `variant`. Changing a `<Badge>`'s
  variant to one those effects don't render, and back, remounted the component
  and issued fresh ids — so the `<clipPath>` and gradient ids their `url(#…)`
  references point at changed identity mid-life.

  Also fixed: `Canvas.tsx`'s paint effect read a stale `helpersForLayers` through
  its closure rather than the ref the file maintains, and `useDeviceProfile`
  ignored a `targetScale` supplied by a provider.

  `composeOrderedLayers` is now generic over the `LayersMap` it receives instead
  of taking `any`; inference at existing call sites is unchanged.

  - @weasel-js/theme@1.2.0

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
