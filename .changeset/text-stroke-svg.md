---
"@weasel-js/svg": minor
"@weasel-js/font": patch
"@weasel-js/core": minor
---

Stroked text.

`TextStyle.stroke` and `StyledRun.stroke` carry a real `Stroke`, and the
outline tier paints it as a second batched draw call over the group's merged
geometry — so a glyph above `textOutlineMinScreenSize` gets real joins, caps
and miters in any paint, because by then it is an ordinary `PolygonPath`.
Width stays a world measure: it crosses into the cached em-space tessellation
by dividing by the glyph's scale, so it does not grow with `fontSize`. Below
the threshold a glyph is a sampled distance field with no geometry to stroke,
and renders unstroked rather than approximated.

`kit:text` also reads the kit-native `data.stroke` / `data.strokeWidth` leaf
fields that `kit:shape` already honors, so one pair of stroke controls means
the same thing on a text node as on a rect.

`@weasel-js/svg` round-trips all of it — node-level and per-`<tspan>` — where
it previously parsed a text stroke into a warning and dropped it.

Two older bugs fell out of building it, both invisible to fills and both
fixed: `extractPolylines` kept a closed contour's duplicate final point
(zero-length closing segment, dropped wrap-around join), and glyph path data
whose contours carried no `Z` stroked as open polylines — a missing closing
edge with a cap at each loose end. A fill closes a contour implicitly; only a
stroke reads the difference.
