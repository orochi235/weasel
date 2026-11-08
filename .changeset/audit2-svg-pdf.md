---
"@weasel-js/svg": patch
"@weasel-js/pdf": patch
"@weasel-js/geom": patch
"@weasel-js/core": patch
---

Fix SVG import and PDF path output found in an audit.

- `writePdf` places a path measured from an origin (far from 0) at its own coordinates instead of offset by the origin.
- `parseSvg` reads `<rect>` `rx`/`ry` as SVG 2 does: a missing or negative radius takes the other's value, the two stay independent, each is clamped to half its own side, and either one at 0 gives square corners.
- `parseSvg` gives an `<ellipse>` radius left out the other's value.
- `pathFromD` reads a form feed between arc arguments as whitespace.
- `parseSvg` multiplies a color's own alpha by `fill-opacity` / `stroke-opacity` rather than replacing it.
- `parseSvg` reads `fill-opacity` and a color's alpha on `<text>` and `<tspan>`, and `serializeSvg` writes a run's fill opacity.
- `serializeSvg`'s default `viewBox` boxes each path's stroke and marker heads, not just its geometry, so a stroked shape at the edge keeps the outer half of its stroke. Core exports `strokedBounds`, the box a stroke covers along a path, which it measures with.
