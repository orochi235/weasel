 # API conventions

Project-wide API design rules for weasel. Add new entries as patterns
emerge — keep each one short, with a rule and a brief rationale.

## Terminology

- **`d`** — shorthand throughout these docs (and the API, e.g.
  `pathFromD`) for **SVG path data**: the string held by SVG's `d`
  attribute (`"M0 0 L100 0 Z"`). When you see "`d` string" or "a `d`",
  it means SVG path data, not a kit-invented format. See *Compose scenes
  in a terse path language* below for why this is the geometry surface.

## Defaults stay explicitly declarable

Props, attributes, and config fields with default values must still
accept the default being passed explicitly. Don't reject, warn, or
treat `tool="none"` (when `"none"` is the default) as redundant.

**Why.** Explicit declaration is a clarity tool — readers shouldn't
have to know the default to understand intent. It lets demos and
consumers self-document.

**Scope.** Applies to React component props, HTML attributes, and JS
config objects. Does *not* apply to positional function arguments or
anywhere requiring explicit defaults would cause organizational chaos.

## Compose scenes in a terse path language, not builder calls

The path language at the composition boundary is **SVG `d` syntax**,
which the kit parses into a `Path` via `pathFromD(d)`. The kit defines no
path DSL of its own, however small: that would be a new standard for
consumers to learn and for us to document, version, and maintain.

A composer chooses among:

1. **Terse declarative form — SVG `d`.** Declare a shape inline,
   `pathFromD("M0 0 L100 0 L100 100 Z")`, and hand it to a scene/op API.
   Usually the right default.
2. **Imperative builders.** `PathBuilder`, `polygonFromPoints`,
   `rectPath`, `ellipsePath`, `regularPolygonPath`, `starPath`,
   `linePath` remain a first-class choice — sometimes the clearest one.
   For a quick triangle `polygonFromPoints([[0,0],[10,0],[5,10]])` may
   read better than a string, and for *computed* geometry (loops,
   parametric shapes) a builder is the natural fit.
3. **Typed-array `Path` (internal performance form).** The
   `commands: Uint8Array` / `coords: Float32Array` command stream
   (`packages/geom/src/path.ts`) is for the kit's monomorphic hot loops
   and low GC pressure. A consumer can reach for it for power, but is
   never required to construct or read it by hand.

On the read/interchange side, standard formats stay first-class:
`pathToAnchors` / `decomposePath` for friendly reads, `@weasel-js/svg`'s
`parseSvg` / `serializeSvg` for document round-trips.

**Why.** Without a parser, every
consumer hand-assembles `polygonFromPoints([...])` (or worse) at each
call site. A terse declarative form pays the parser
cost once, in the kit, and lets scene composition read as data.

**Status.** `pathFromD(d)` ships from `@weasel-js/geom` (`packages/geom/src/paths/pathFromD.ts`, re-exported by core)
and accepts the full SVG `d` grammar (`M L H V C S Q T A Z`, absolute +
relative, smooth-curve reflection, arc→cubic), lowering it to the stored
`Path`. `@weasel-js/svg`'s document parser imports the same function, so the
`d` coverage is shared.

**Ratified rule: kit APIs speak `Path`; `pathFromD` is the only string
doorway.** Every path-bearing kit parameter takes the typed `Path`
(`PolygonPath | RectPath`) — `createSetPathOp`, the boolean ops,
`PathBuilder.fromPath`, `createPathLayer`, the hit-tests, the geometry slot
in a node's `data`. **Do not introduce a `string | Path` (`PathLike`) union
into those signatures.** A `d` string is converted exactly once, at the
boundary, via an explicit `pathFromD(d)` call; the resulting `Path` is what
flows through the kit.

Why:

1. **The surface is homogeneous on `Path`.** There are no string-shaped
   path params; accepting `d` inline would introduce polymorphism where
   none exists.
2. **It can't be made universal.** The kit is generic over `TNode` /
   `TData` and does not own where geometry lives in a consumer's node. An
   inline-`d` convention could only intercept the kit's own typed slots, not
   `node.data`, so strings would work in some places and not others.
3. **Cost.** `pathFromD` parses on each call. An explicit call
   at the boundary parses once and reuses the `Path`; a buried `string | Path`
   invites silent re-parsing in loops / re-inserts, and leaves `onWarn` with
   nowhere clean to go.

**Scope.** Applies to public hooks, ops, and component props that ingest
or emit geometry. Internal kit code uses the typed-array form directly —
this rule governs the consumer boundary, not kit internals.

## Pairs that look duplicated and are not

A duplication audit flags these again each time. Each stays two, for the reason given.

Local- vs world-space bounds, and `nodeAtPoint` vs `pickBest`, are different
questions. Miter apex vs capsule, and butt cap vs half-disc, are a defensible hit
model over shared base geometry. `unionBounds` stays rotation-free beside
`unionAABB` for commit-time actions that write poses back in the unrotated frame.
SVG's `#000000` initial fill is a spec default, not drift. `resolveNodeFill`'s
split between `kit:path` and `kit:shape` is documented and correct.
`useBuiltinShapeTools`' nine hook calls are not a list, and are already
compiler-linked through the return type. `sceneToAdapter`'s area walk
returns containers where the live marquee dep does not — one flag on the shared
walk, because a bare-adapter consumer has no selection parent-folding to fold
them back in.

In labkit, modes, d3, paint, and ui:
labkit's camera (`worldToScreen`, `zoomAt`, `centerOn`, `clampZoomAbout`) is a
pan/zoom/`yDir` view model, not affine kernel math. labkit's `fitView` anchors at
the origin where `TrialOverview`'s `fitRect` centers with padding. `toShape`
collapses a zero-size axis to 0 where `boxToBox` keeps scale 1, and Plot2D's
`modelToPlot` fails on a zero range where `boxToBox` would silently not scale.
`toDeviceRect` is a y-flip plus device-pixel snap. Badge's `polygonSampler`
parameterizes a polygon by CSS-pixel arc length under the viewBox's anisotropic
scale, and Powerline carries its own normals. paint's `lerpHueDeg` is CSS Color 4
hue interpolation, not angle geometry. CurveEditor's Catmull-Rom and monotone
splines are curves geom does not have, and its bezier easing already goes through
geom's `cubicBezierEasing` (via core). The scalar `Math.max(lo, Math.min(hi, v))` clamps
scattered through ui and labkit are not geometry; geom has no scalar clamp. d3
and modes do no geometry at all.

## Kit settings

A timing, threshold, target size or rate that a user would set once for
every component is a kit setting, not a module constant alone. The constant
stays, as the only definition of the default; the component reads
`useKitSetting('<area>.<leaf>') ?? CONSTANT`, and code outside React reads
`get(path)` from `useKitSettings()` (the canvas publishes that store as the
`kitSettings` dep) at the moment it needs the value; a gesture behavior or
snap strategy finds that store on its `GestureContext` as `kitSettings`. A
component's own prop still wins over a provider.

To add one: augment `KitSettings` from `@weasel-js/react` in the package's
`kitSettings.ts` (`targets` leaves go on `KitTargetSettings`, which several
packages add to), read it as above, and add a leaf to the package's
`*KitSettingsSchema` whose default imports the constant. Each schema group
has a test that its defaults equal the constants.

A numeric limit the code depends on — renderer slack, animator retiming, a
budget, a dev tool's timeout — stays a constant: listing it as a setting
says changing it is supported.

## Every public export is documented and nameable

`npm run audit:jsdoc` must report zero undocumented exports and no
`@internal` symbol on a consumer entry, and CI fails on either
(`audit:jsdoc -- --check`); `npx typedoc` must report no
warnings, and its usual one is a documented export referencing a type the
barrel does not export. Run both before adding an export. Export the
referenced type rather than listing it in the package's
`typedoc.config.mjs` under `intentionallyNotExported`.

Test-only reset hooks go on the package's `test-seams` entry; types a sibling
package fills across the boundary go on an `internal` entry
(`@weasel-js/routing/internal`). Neither is public API, and the audit treats an
`@internal` symbol there as placed rather than leaked.

## Design tokens

`--wzl-*` tokens are generated. Edit `packages/theme/themes/<theme>.json`
(a theme definition) and run `npm run gen:tokens -w @weasel-js/theme`; never edit
`packages/theme/src/generated/`. A determinism test fails CI if the committed
output doesn't match what the generator produces from the source.

Token names are the definition's keys — `fg-muted` becomes `--wzl-fg-muted`, and
a reference in a pin's value is written `{fg-muted}`, while a semantic's `ref`
names the token bare (`"ref": "gray-800"`). A value that differs per axis is written
`{ by: 'mode', dark: …, light: … }`; an `alpha` on a reference emits
`color-mix()` in CSS and a computed `rgba()` in JS.

Text emphasis is relative. `--wzl-fg-muted` and `--wzl-fg-subtle` are
`rgb(from currentColor r g b / <alpha>)`, so they step down from whatever text
color is in effect — on an accent fill, a raised row, or a sunken rail alike —
and muted text nested in muted text stays one step down rather than compounding.
In `color` the base is the parent's text color; in any other property
(`border-color`, `fill`, `background`) it is the element's own `color`, so an
element that never sets one steps down from the UA's `buttontext` or
`fieldtext`. Give such an element `color: inherit`, and reach for `--wzl-fg` at
an alpha where the base must not follow the element (a slider thumb carrying
inverse text).

An accent fill is the exception: there the general alphas fall below 4.5:1. A
rule that sets `color: var(--wzl-fg-on-accent)` also sets `--wzl-fg-muted:
var(--wzl-fg-muted-on-accent)` and `--wzl-fg-subtle: var(--wzl-fg-subtle-on-accent)`,
and `npm run check:on-accent` fails on one that doesn't. In dark mode that pair is
0.98 and 0.96, so on the accent the steps all but disappear: legibility won over
hierarchy.

### Sizing

Sizes are baked px, never `calc()` against a root variable. `tokenPx()` is how a
size reaches drawing code — SVG geometry attributes, canvas, WebGL — and it
parses a plain px length, throwing rather than guessing. A `calc()` token would
have no number for it to read. The same reason rules out `rem`: text that scales
inside boxes that don't is worse than neither scaling.

Scaling is therefore a **theme axis**, not arithmetic. `density` —
`compact` / `comfortable` / `roomy` — varies `seeds.ui-base`, which the
`font-size` scale derives its whole ramp from, along with `control-h` and
`tb-height`. Set it with `applyTheme(el, theme, { density })`, which stamps
`data-wzl-density` and publishes the matching block. `tokenPx(name, resolved)`
follows, because `resolveTheme` resolves at a selection.

The type ramp uses `factors` rather than a `ratio`: its small end is compressed
on purpose, because chrome text stops being legible before a geometric ramp
stops shrinking.

Spacing is the `space-1` … `space-8` ladder, 2px rungs. `space-xs/sm/md/lg` are
aliases for rungs 2/4/6/8. It does not vary by density — the rungs are finer
than any density factor could resolve without rounding two of them onto the same
pixel. `npm run check:spacing` fails on a `gap`/`padding`/`margin` px literal that
has a rung, in any package or app stylesheet. Core, which draws on a page that
may load no theme, writes the rung with its px as the fallback; it is the one
package `check:token-reads` lets do that.

Control heights are four ranks, `control-h-xs` / `-sm` / `control-h` /
`tb-height` — 18/20/24/28 at `comfortable`. A control box sizes itself from one
of them, never from a literal: a literal is what left `Button` at 24px in every
density while its label grew. `npm run check:controls` fails on a
`height`/`min-height`/`block-size` literal in `packages/ui/src` that equals a
rank.

What deliberately does *not* follow density: icons and drawn glyphs (a chevron,
a checkmark, a switch track), slider tracks and thumbs, and handles — those have
their own tokens or are artwork. Scaling them with the type ramp makes them
blurry rather than bigger.

### Gloss

`--wzl-gloss` is how much Aqua glass a boxed `Button` and a selected segment of
`ToggleBar`, `ButtonBar`, or `OptionsBar` wear, from 0 to 1. The default theme
sets 0: a flat accent fill, and for a secondary button the raised surface inside
a 1px `--wzl-border-strong` line. At 1 they draw the ramp, the specular gloss,
the rim, and the drop shadow. A theme turns the glass on by setting the token,
and so does any ancestor that declares it. Each rule lays its flat fill over the
ramp and fades the fill out as the gloss and shadows fade in, so a control that
draws the ramp reads the token for every part of it.

### Shading

A shadow that lifts a surface off what is under it is a token: `--wzl-shadow`, which is
darker than any surface in either mode, and the `--wzl-bevel-*` hooks a theme draws its
relief with.

Shading that is part of one control's own artwork is black or white at an alpha, written
where it is drawn: `Badge`'s bevel fills and text shadow, the default colors of its `Metal`
and `Sunbeams` effects, the `Slider` thumb's shadows, the segmented track's well, and the
glass ramp's gloss, rim, and drop shadows in `Button` and the selected segment. It is light
falling on a shape, not a color of the theme. A highlight is white and a shade is black
whichever mode is in effect, and both composite over any fill, where a token would be a
color that follows the mode and turns a highlight into a shade. A theme tunes how much of
it shows, with `--wzl-gloss`, `--btn-*`, and the bevel hooks, and never what color it is.

### Layers

Anything that draws over the page takes its `z-index` from the `--wzl-z-*`
ladder, so a consumer who retunes a rung moves every layer on it:

| Rung | Value | Holds |
|---|---|---|
| `--wzl-z-toolbar` | 10 | chrome pinned over a workspace |
| `--wzl-z-overlay` | 20 | a panel or readout floating over the chrome |
| `--wzl-z-hud` | 900 | core's debug HUDs |
| `--wzl-z-modal` | 1000 | `Dialog`, labkit's lightbox |
| `--wzl-z-toast` | 1100 | toasts |
| `--wzl-z-popover` | 1200 | `Tooltip`, `Callout` |
| `--wzl-z-drag` | 10000 | drag ghosts |

Core reads its rungs with a fallback (`var(--wzl-z-hud, 900)`), since it draws
on a page that may load no theme. A small literal that orders siblings inside one stacking
context is fine. `npm run check:layers` fails on a `z-index` literal, in a
stylesheet or in script, at or above the lowest rung.

### Panel labels

Labels on the params surfaces — `PropertyPanel`, `Prefs` and labkit's
`ControlPanel` — take their case, tracking, alignment and width from
custom properties. Set any of them on an ancestor and every label beneath
follows; nothing needs outranking, because no rule declares them — each label
reads its default as a `var()` fallback.

| Property | Default | Reaches |
|---|---|---|
| `--wzl-params-label-case` | `uppercase` | every label and title |
| `--wzl-params-label-tracking` | `--wzl-tracking-wide` on rows, `-wider` on titles | every label and title |
| `--wzl-params-label-align` | `start` | row labels |
| `--wzl-params-label-width` | `auto` | row labels beside their control |

Alignment does nothing until a width gives the label room: at `auto` a label is
exactly as wide as its text. Give a panel a width and its labels form one
column. A stacked row with a readout on its label line keeps the label at the
start whatever the alignment, because the readout holds the end.

`DetailList`, the read-only label/value list, reads all four too: its label
column is `--wzl-params-label-width` wide, so one declaration lines its labels
up with a property panel's inline rows. labkit's `Readout` is a `DetailList`,
so a lab's measurements line up with its `ControlPanel` the same way.

Custom properties are the mechanism because they inherit across the CSS-module
boundary: labkit's Less cannot name `PropertyPanel`'s label class.
`npm run check:labels` fails on a label in
those surfaces that sets its case or tracking any other way.

### Numeric text

Figures read as values — readouts, counters, number inputs, a column of
numbers, axis ticks — are set in equal-width digits. Oswald has no tabular
figures, so `tabular-nums` alone aligns nothing; the numeric face
(`--wzl-font-numeric`, Oswald's digits re-spaced to one width) is what does.
Both declarations live in one class, `.numeric` in
`@weasel-js/theme/numeric.module.css`, and everything takes it from there:

| Where | How |
|---|---|
| a CSS module, single-class rule | `composes: numeric from '@weasel-js/theme/numeric.module.css';` |
| Less (labkit) | `.numeric();` — `styles.less` imports the module as a reference |
| a global stylesheet or TSX | `import num from '@weasel-js/theme/numeric.module.css'`, then `num.numeric` on the element |
| a table | `DataGrid` column `numeric: true`; `DetailList values="figures"` |

`NumberField` and `UnitField` carry it on their frame, so a number input needs
nothing. A rule that takes the helper must not also set `font`, `font-family`
or `font-variant-numeric`: the composed class is declared first, so any of them
replaces it — split a `font:` shorthand into longhands. Prose that happens to
hold a number stays proportional, and code or hex stays in the mono face.
`npm run check:numeric` fails on `tabular-nums` or a read of the token anywhere
else, and on a font property beside the helper.

### Stance and tone

A surface that holds a class of content says which with `stance` —
`scope`, `aside`, `advanced`, `debug`, `danger`, `notice`, `important`,
`preview` — and which of its peers it is with `tone`: an index into the theme's
tone list (`ThemeDefinition.tones`, a `ColorList`; weasel's is the swatch ramp),
or a `ColorSource` (`@weasel-js/paint`): a literal, or a ref such as `{ ref: 'accent' }`,
resolved by `colorSourceCss` (`@weasel-js/theme`; `useColorCss` in a component),
as is every other color a kit component takes. `PropertyPanel`, `PropertyGroup`, `MotifFrame`, `Subpanel`, `Callout`, `Dialog`,
labkit's `ControlPanel` and sidebar sections take both; `LayerList`'s items
take a tone only, since a list's cards are one kind of thing. `Badge`, `Code`,
`Button` and `Powerline` segments take both too, beside the `status` they report
(`success`, `danger`, …); a tone, or a stance's `accent`, paints over the status
color, and a toned primary button takes the tone as its accent. Toasts take
neither: a toast reports how an event came out rather than holding a class of
content. The hud `window` takes both, drawn in WebGL from the resolved theme:
`resolveStanceSlots` (`@weasel-js/theme`) makes the same lookup the generated CSS
does, `colorSourceLiteral` resolves the tone with no cascade to ask, and `mixOklab`
(`@weasel-js/paint`) mixes it in. Anything else that takes several colors — chart series, diagram
categories — takes a `ColorList` (`@weasel-js/theme`), read with `colorAt` /
`colorCssAt`, rather than hand-picked color strings that suit only one mode.

The theme decides the look. A stance reads `--wzl-stance-<stance>-<slot>` (the
slots are `STANCE_SLOTS` in `@weasel-js/theme`) and falls back to the surface's
own look, so a theme declares only what a stance changes, and a stance looks the
same on every surface. A nested panel reads `-nested-<slot>` first. A surface
that names a tone recolors the controls inside it; a stance's own tone, like
`danger`'s, tints the fill and leaves the controls alone.

To give another surface a stance, add it to
`packages/ui/src/components/stanceSurfaces.ts` with its base look, put an empty
generated region in its stylesheet, run `npm run gen:stances`, paint its
properties from the `--_s-*` names, and spread `useStance()` on its root.

Tones mix `in oklab`. In `oklch` the mix takes its hue from weasel's slightly
blue grays, so a green tone comes out blue.

### Motifs

A **motif** is how a titled frame draws its title and its edge: a visual idiom
borrowed from something real. It's neither a stance (what a surface holds) nor a
theme (token values). `<MotifFrame motif>` and `<PropertyGroup motif>` take one
from a factory: `rule()` (a title between two rules, the default), `stereo()` (a
label bar along one edge, as on the back of an A/V receiver), `notch()` (the
title cut into the border), `tab()`, `plaque()` (the tone fills the frame) and
`titlebar()` (a solid strip across the top, as a desktop window is titled).
The root barrel has them as `motifs.stereo()`; `@weasel-js/ui/components/MotifFrame`
exports the bare names. `<DefaultMotif motif>` changes the default for every
frame below it, which is how an app pairs a theme with the motif it wants.

`titlebar` is the one motif a theme repaints: its strip, its title's color and
alignment, and the frame's border and inset are the `--wzl-titlebar-*` hooks,
and its edge takes `--wzl-bevel-raised`. A frame that names a tone paints the
tone over the theme's strip.

A motif renders the frame's root element itself, so it picks the element as well
as the layout: `notch` must be a `<fieldset>`, because a `<legend>` cuts the
border where a positioned title would only cover it. Geometry belongs to the
motif and color to the stance. A motif paints its own border widths, padding and
radii, and reads only colors and the title's type from the `--_s-*` slots,
because a theme's stance tokens are tuned for one look (`scope` sets a border
width of 0) and would erase the edge another motif is made of. `rule` is the
exception: its look is the slots' defaults.

To write a motif, return `{ id, params, render(frame) }` from a factory, spread
`withMotifClass(frame.root, yourClass)` on the root, and place `frame.heading`'s
parts. `--_edge` is the tone, or the stance's border color without one, and
`--_edge-ink` is black or white, whichever reads on it. A motif that fills with
something else redefines `--_edge` on its root, and the ink follows. The ink
switches at oklch L 0.564: WCAG's 4.5:1 holds for white below a luminance of
0.183 and for black above 0.175, so the switch has to sit within a hundredth of
that lightness, or the losing side falls short there.
