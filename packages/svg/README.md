# @weasel-js/svg

SVG import/export for @weasel-js/core: parse SVG strings into weasel-native shapes and serialize them back.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/api/).

## Install

```sh
npm install @weasel-js/svg
```

## Usage

```ts
import { /* … */ } from '@weasel-js/svg';
```

## Text fidelity

Two things worth knowing before you rely on a text round-trip.

**The format is exactly as expressive as the runs model.** A run can turn
`underline` on but not off, so `<g text-decoration="underline"><text
text-decoration="none">` has no representation on the way in — and neither
does "this word is not underlined inside an underlined node" on the way out.
That is not loss in the serializer; it is the model, faithfully reproduced. A
future "un-underline this word" feature needs a model change, not a
serializer change. (Contrast `letterSpacing`, where the model *was* more
expressive than the serializer — that was a real data-loss bug, since fixed.)

**Decoration is treated as inherited.** Real CSS says `text-decoration` is
not inherited and cannot be cancelled by a descendant; a browser shown
`<g text-decoration="underline"><text text-decoration="none">` still
underlines. This parser reads it as not-underlined. A deliberate difference:
for a document editor, honoring the child's stated intent is the friendlier
answer, and the alternative is unrepresentable anyway (see above). It only
shows up on foreign SVG that sets decoration on a group and cancels it on a
child.

## Paints SVG cannot express

SVG has `<linearGradient>`, `<radialGradient>` and `<pattern>` and nothing
else, so a conic gradient — or any paint kind a consumer registers — has no
element to serialize into. Both go out as a def in weasel's own namespace,
declared on the root as `xmlns:wzl="urn:weasel-js:svg"` only when a document
holds such a paint:

```xml
<defs><wzl:conicGradient id="grad0" gradientUnits="objectBoundingBox"
  cx="0.5" cy="0.5" angle="0.25"><stop offset="0" stop-color="#ff0000"/>
  <stop offset="1" stop-color="#0000ff"/></wzl:conicGradient></defs>
<path fill="url(#grad0) #ff0000" d="…"/>
```

The color after the reference is SVG's own paint fallback: this package reads
the def back and reproduces the paint exactly, every other renderer skips the
def it does not know and paints that flat color instead. A registered kind's
`toSvg` gets the same treatment, with the fallback taken from its `colorOf` —
or `none` when the kind has no single color, so an unresolvable reference
paints nothing rather than something arbitrary.

That cuts both ways on import: a `fill="url(#mesh1) #c04a3f"` from Inkscape,
whose mesh gradients this package does not model, imports as flat `#c04a3f`
rather than as a dropped fill.

`serializeSvg` is synchronous, so a kind loaded on demand (`mesh-gradient`, or
one declared with `registerPaintKindLoader`) that has not landed yet has no
`toSvg` to call, and its def is left out with a warning. `await warmSvg(nodes)`
first loads the kinds those nodes paint with, and the faces a sub- or
superscript run with its own `baselineShift` takes its size from — nothing
else, so an unrelated kind that fails to load cannot fail the export.
`svgNeeds(nodes)` lists the same things without loading them.

### A gradient's blend space

A gradient's `interpolate` — `'oklab'` or `'oklch'` — has no SVG spelling
either: `color-interpolation` carries `sRGB` and `linearRGB` only. It goes out
as `wzl:interpolate` on the gradient's *own* element, which stays
`<linearGradient>` or `<radialGradient>`:

```xml
<linearGradient id="grad0" gradientUnits="objectBoundingBox"
  x1="0" y1="0" x2="1" y2="0" wzl:interpolate="oklch">…</linearGradient>
```

No fallback color rides along, because a foreign renderer still paints the
gradient — it just blends the stops in sRGB, which moves the midpoint rather
than losing the paint. A space this package does not know is dropped on import
rather than carried through.

## Scene nodes, both ways

`svgNodesToKitDrafts(parseSvg(text), nextId)` lowers a document to scene-node
drafts the kit's built-in path, text and image painters draw, and registers
the document's markers. Containers carry no opacity, so an element or group
`opacity` is multiplied into the paints of the leaves under it. `nextId` is
handed the node each id is for, and `options.leaf` maps each leaf's kit data
into data of your own shape, from the source node's metadata too.

`svgNodesFromKit(scene)` goes the other way: containers become groups, and
each leaf is written the way its painter draws it, with the pose baked into
the geometry and box-relative paints resolved into that box. Hand
`serializeSvg` the result. Options pick the roots, skip nodes (a hidden
layer), replace a leaf's lowering or decorate a group. The per-leaf pieces are
public too: `svgLeafFromKit`, `svgPaintFromKit`, `svgStrokeFromKit`,
`svgImageFromKit`.

## Stroke markers

A marker reference goes out as `marker-start` / `-mid` / `-end="url(#id)"` with
one `<marker>` def per distinct reference. The path keeps its full-length `d`:
baking the kit's inset in would have a re-import trim the line a second time.
The cost is that other renderers draw the line under a hollow head.

| Reference | Def id | What the def carries |
|---|---|---|
| `'arrow'` | `arrow` | `markerUnits="strokeWidth"` |
| `{ key: 'arrow', size: 3 }` | `arrow-s3` | `markerUnits="userSpaceOnUse"`, `wzl:key="arrow"`, `wzl:size="3"` |
| `{ key: 'arrow', size: { px: 6 } }` | `arrow-s6px` | the same, drawn at 6 user units, `wzl:size="6px"` |

Any entry with a nonzero inset adds `wzl:inset` in marker units, and the root
declares the `wzl` namespace whenever one of these attributes appears. `orient`
is `auto-start-reverse`, because the kit turns every start head around, or an
entry's fixed angle in degrees. An entry with its own `toSvg` writes its own
def and gets none of the `wzl` attributes (a sized reference to one warns). A
reference to a key nothing registered writes no attribute.

On import, `url(#id)` naming a registered key reads back as that key, so an
unsized built-in needs no def. A def with `wzl:key` and `wzl:size` reads back
as that sized reference, registering the def's geometry under the key if
nothing else has. Any other `<marker>` becomes an entry in
`ParseResult.markers`, keyed by its id plus a hash of what it draws, and
`svgNodesToKitDrafts` registers it. It is minted per reference rather than per
def, because a `userSpaceOnUse` size and an `orient="auto"` start both depend on
the referencing stroke. `wzl:inset` restores the inset; without it the inset is
0. A reference to a marker neither registered nor defined warns and is dropped.

## Stylesheets

`<style>` rules cascade with the presentation attributes and `style=""`. A parse
is one static render, so `@media` and `<style media>` are answered once, against
a fixed environment: a `screen` whose viewport is the root's `width`/`height`
(else its `viewBox`, else 300 × 150), `prefers-color-scheme: light`, and no
hover or pointer. Pass `parseSvg(svg, { media: { prefersColorScheme: 'dark',
width: 1200 } })` to render for different media; `evaluateMediaQuery` answers a
query against the same environment.

`@supports` asks whether this parser honors a declaration, not whether a browser
parses it: `(fill: red)` holds, `(display: grid)` and `(clip-path: url(#c))` do
not, because nothing reads them from a stylesheet. `@import` is not fetched, and
each one is reported in `warnings`. Rules inside `@layer`, `@container` and
other at-rules are skipped.

## Raster images

`<image>` parses to an `SvgImageNode` holding the `href` verbatim — an
external URL or a `data:` URI — plus a box. The package never fetches or
decodes it, so an external URL round-trips as a reference and resolves only
when something downstream loads it. `unpackSvgFiles` maps the node onto the
kit's `kit:image` painter (`data.image.src`), which does load it.

A source rect and flips (`source`, `flipX`, `flipY`) are written as a nested
`<svg viewBox>` viewport and read back as the same node. `unpackSvgFiles`
carries them onto `data.image` under the same names, and `svgImageFromKit`
writes a `kit:image` leaf back as an `SvgImageNode`.

`preserveAspectRatio` is not modeled. The box is taken literally on the way
in (a non-`none` value warns) and written back as `none`, so a source file
that relied on letterboxing imports stretched.

## License

MIT
