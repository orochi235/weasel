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

## Raster images

`<image>` parses to an `SvgImageNode` holding the `href` verbatim — an
external URL or a `data:` URI — plus a box. The package never fetches or
decodes it, so an external URL round-trips as a reference and resolves only
when something downstream loads it. `unpackSvgFiles` maps the node onto the
kit's `kit:image` painter (`data.image.src`), which does load it.

`preserveAspectRatio` is not modeled. The box is taken literally on the way
in (a non-`none` value warns) and written back as `none`, so a source file
that relied on letterboxing imports stretched.

## License

MIT
