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

We want the **expressive power of a path language** at the composition
boundary — but **without minting a new external standard** for consumers
to learn or for us to document, version, and maintain. The resolution is
to adopt the path language the world already speaks: **SVG `d` syntax.**
It's universal, needs no learning, and the kit parses it into a `Path`
via `pathFromD(d)`. A bespoke weasel path DSL — even a
"small" compact literal grammar — is exactly the wrong move: it's a new
standard wearing a terse costume.

So a composer gets a **choice**, and the terse end of it is just SVG:

1. **Terse declarative form — SVG `d`.** Declare a shape inline,
   `pathFromD("M0 0 L100 0 L100 100 Z")`, and hand it to a scene/op API.
   Full path-language expressiveness, zero new vocabulary. Usually the
   right default.
2. **Imperative builders.** `PathBuilder`, `polygonFromPoints`,
   `rectPath`, `ellipsePath`, `regularPolygonPath`, `starPath`,
   `linePath` remain a first-class choice — sometimes the clearest one.
   For a quick triangle `polygonFromPoints([[0,0],[10,0],[5,10]])` may
   read better than a string, and for *computed* geometry (loops,
   parametric shapes) a builder is the natural fit. These are ordinary
   function calls with plain args — not a grammar — so they cost no new
   standard either. The terse form makes them less frequently
   *necessary*, not unavailable.
3. **Typed-array `Path` (internal performance form).** The
   `commands: Uint8Array` / `coords: Float32Array` command stream
   (`packages/core/src/features/paths/types.ts`) is for the kit's monomorphic hot loops
   and low GC pressure. A consumer can reach for it for power, but is
   never required to construct or read it by hand.

Two principles, both load-bearing: **choice** (don't push a composer
toward a builder for simple authored geometry because nothing terser
exists) and **no new standard** (reach the power through SVG `d`, which
every consumer already knows, rather than a kit-invented path grammar).

On the read/interchange side, standard formats stay first-class:
`pathToAnchors` / `decomposePath` for friendly reads, `@weasel-js/svg`'s
`parseSvg` / `serializeSvg` for document round-trips.

**Why — and the paradox.** Adding a small path-language parser *reduces*
net implementation complexity rather than adding to it. Without it, every
consumer hand-assembles `polygonFromPoints([...])` (or worse) at each
call site; the friction is paid N times across the ecosystem and the
imperative code obscures intent. A terse declarative form pays the parser
cost once, in the kit, and lets scene composition read as data. *Let
consumers learn the typed-array form when they want its power — don't
make them learn even the builders just to drop one shape on the canvas.*

**Status.** `pathFromD(d)` ships from core (`packages/core/src/features/paths/pathFromD.ts`)
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

Three reasons this is the settled choice, not a deferral:

1. **Preserves a property the surface already has.** The path-bearing
   surface is homogeneous on `Path` today — there are zero string-shaped
   path params. Accepting `d` inline would *introduce* polymorphism where
   none exists, not remove friction from it.
2. **It can't be made universal anyway.** The kit is generic over `TNode` /
   `TData` and does not own where geometry lives in a consumer's node. An
   inline-`d` convention could only intercept the kit's own typed slots, not
   `node.data` — so it would buy an inconsistent surface (strings work
   *here* but not *there*), which is worse than one uniform rule.
3. **Honest about cost.** `pathFromD` parses on each call. An explicit call
   at the boundary parses once and reuses the `Path`; a buried `string | Path`
   invites silent re-parsing in loops / re-inserts, and leaves `onWarn` with
   nowhere clean to go.

The terse-authoring win is fully delivered by `pathFromD` *existing* — a
consumer writes `pathFromD("M0 0 …")` instead of hand-assembling a builder.
That one call is the ergonomic, and it's enough.

**Scope.** Applies to public hooks, ops, and component props that ingest
or emit geometry. Internal kit code uses the typed-array form directly —
this rule governs the consumer boundary, not kit internals.

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
pixel. `npm run check:spacing` fails on a `gap`/`padding`/`margin` px literal in
`packages/ui/src` that has a rung.

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

### Panel labels

Labels on the params surfaces — `PropertyPanel`, `Prefs` and labkit's
`ControlPanel` — take their case, tracking, alignment and width from four
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
up with a property panel's inline rows.

Custom properties are the mechanism because they inherit across the CSS-module
boundary: labkit's Less cannot name `PropertyPanel`'s label class, and before
this it restated the recipe by hand. `npm run check:labels` fails on a label in
those three surfaces that sets its case or tracking any other way.

### Stance and tone

A surface that holds a class of content says which with `stance` —
`scope`, `aside`, `advanced`, `debug`, `danger`, `notice`, `important`,
`preview` — and which of its peers it is with `tone`: an index into the theme's
tone list (`ThemeDefinition.tones`, a `ColorList`; weasel's is the swatch ramp),
or a color. `PropertyPanel`, `PropertyGroup`, `Subpanel`, `Callout`, `Dialog`,
labkit's `ControlPanel` and sidebar sections take both; `LayerList`'s items
take a tone only, since a list's cards are one kind of thing. `Badge`, `Code`,
`Button` and `Powerline` segments take both too, beside the `status` they report
(`success`, `danger`, …); a tone, or a stance's `accent`, paints over the status
color, and a toned primary button takes the tone as its accent. Toasts take
neither: a toast reports how an event came out rather than holding a class of
content. The hud `window` takes both, drawn in WebGL from the resolved theme:
`resolveStanceSlots` (`@weasel-js/theme`) makes the same lookup the generated CSS
does, and `mixOklab` (`@weasel-js/paint`) mixes the tone in. Anything else that takes several colors — chart series, diagram
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
