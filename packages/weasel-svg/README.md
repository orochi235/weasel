# @orochi235/weasel-svg

SVG import / export for [`@orochi235/weasel`](../../). Parse an SVG string into a tree of weasel-native shapes (`Path`, `FillStyle`, `Stroke`); serialize the same tree back to an SVG document.

The package has zero runtime dependencies outside `@orochi235/weasel` — the path-`d` parser, transform parser, and color parser are all hand-rolled and live in this package.

## Quick start

```ts
import { parseSvg, serializeSvg } from '@orochi235/weasel-svg';

const { nodes, warnings } = parseSvg(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="10" y="10" width="80" height="80" fill="#ff0000"/>
  </svg>
`);

// nodes: [{ kind: 'path', path: { kind: 'rect', x: 10, y: 10, ... }, fill: { kind: 'solid', color: '#ff0000' } }]

const svg = serializeSvg(nodes);
// '<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 80 80"><path d="M10 10h80v80h-80Z" fill="#ff0000" stroke="none"/></svg>'
```

`warnings[]` collects non-fatal notices (unsupported elements, unrecognized attribute values). The parser never throws on bad input — pathological documents return an empty `nodes` array plus a warning.

## Element coverage

| SVG element        | Parse | Serialize | Notes                                              |
| ------------------ | :---: | :-------: | -------------------------------------------------- |
| `<svg>`            |  yes  |    yes    | `viewBox` ignored on parse; computed on serialize. |
| `<g>`              |  yes  |    yes    | `transform` collapsed onto leaves at parse.        |
| `<rect>`           |  yes  |     —     | `rx`/`ry` → cubic-curve rounded corners.           |
| `<circle>`         |  yes  |     —     | Lowered to `<path>` (4 cubic segments).            |
| `<ellipse>`        |  yes  |     —     | Lowered to `<path>` (4 cubic segments).            |
| `<line>`           |  yes  |     —     | Lowered to open polygon path.                      |
| `<polyline>`       |  yes  |     —     | Lowered to open polygon path.                      |
| `<polygon>`        |  yes  |     —     | Lowered to closed polygon path.                    |
| `<path>`           |  yes  |    yes    | All commands: M/m L/l H/h V/v C/c S/s Q/q T/t A/a Z/z. |
| `<text>` + `<tspan>` |  yes  |  yes  | Maps to `SvgTextNode` with weasel's `TextStyle` + `StyledRun[]`. Stashes box dims in `data-weasel-width` / `data-weasel-height` for lossless round-trip; external text without those attrs imports with estimated dimensions. Stroked text not supported. |
| `<linearGradient>` |  yes  |    yes    | Inside `<defs>`. `userSpaceOnUse` coords.          |
| `<radialGradient>` |  yes  |    yes    | Inside `<defs>`. `userSpaceOnUse` coords.          |

Serialization always emits leaves as `<path>` — there is no `<rect>` / `<circle>` / etc. on output. This keeps the serializer trivial and the round-trip property `nodes == parse(serialize(nodes))` honest.

### Attribute coverage

| Attribute                                                      |       Notes                                                |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| `fill`, `fill-opacity`                                         | Solid (hex, `rgb()`/`rgba()`, named, `none`) + `url(#id)`. |
| `stroke`, `stroke-width`, `stroke-opacity`                     | Same paint surface as `fill`.                              |
| `stroke-linecap`, `stroke-linejoin`, `stroke-dasharray`        | Enum/array fields on `SvgStroke`. `arcs`/`miter-clip` → miter with warning. |
| `stroke-miterlimit`                                            | Number ≥ 1. Weasel's renderer defaults to 10 (Canvas2D); SVG's default is 4 — parser only sets the field when the attribute is present, so untagged sources render with weasel's default. |
| `opacity`                                                      | Element-level, 0..1.                                       |
| `transform`                                                    | `matrix`, `translate`, `scale`, `rotate`, `skewX`/`skewY`. |
| Path `d=`                                                      | Every command in the SVG 1.1 path grammar.                 |

### Transforms

Parsing collapses every `transform="..."` onto its descendants' geometry. The returned `SvgNode` tree never has a non-identity group transform. When you construct a tree manually before calling `serializeSvg`, you can still attach a `transform` to a group — the serializer will emit it as a single `matrix(a b c d e f)`.

Arc commands (`A`/`a`) are converted to cubic Bezier approximations using the standard endpoint-parameterization algorithm (SVG spec F.6.5), split into ≤ 90° segments.

## Lossy cases

- **Element kind.** Rects, circles, ellipses, lines, polylines, and polygons all serialize as `<path>`. The original element label isn't preserved.
- **Rounded rects.** `rx`/`ry` lower to cubic-Bezier corner approximations. They round-trip as geometry, but not as `rx`/`ry` attribute values.
- **Arc commands.** Round-tripping a `<path d="... A ...">` produces a path full of cubics, not the original arc command.
- **Named colors** outside the small inlined table are not recognized — they appear as warnings.
- **Gradient transforms** (`gradientTransform`) are not read. Gradient coordinates are interpreted as `userSpaceOnUse`.

## Out of scope (v1)

`clipPath`, `mask`, `filter`, `<pattern>`, `<use>`/`<symbol>`/non-gradient `<defs>` entries, `<marker>`, `<foreignObject>`, CSS `<style>` cascade, presentation attributes via CSS selectors. Anything unsupported emits a `warnings[]` entry naming the element / attribute.

## Tests

```sh
# From the repo root:
npx vitest run packages/weasel-svg
```

Three test files:

- `roundtrip.test.ts` — 8 hand-rolled fixtures, each asserting `nodes == parse(serialize(parse(svg)))`.
- `path-parser.test.ts` — every SVG path command letter exercised at least once.
- `warnings.test.ts` — unsupported elements (`<text>`, `<clipPath>`, `<filter>`, `<use>`, `<foreignObject>`) produce warnings and don't throw.
