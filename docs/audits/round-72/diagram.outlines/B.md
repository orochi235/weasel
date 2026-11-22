## A folder narrower than its tab depth folds its outline through itself
- where: packages/diagram/src/outlines/storage.ts:95 (tabOf, folder.path)
- scenario: a folder node resized to w = 10, h = 100 → t = min(16, 20) = 16, tw = max(min(4, 10 − 32), 0) = 0, so the tab's slope ends at (x + tw + t, y + t) = (x + 16, y + 16), past the right edge x + 10. The polygon then runs back to (x + 10, y + 16), crossing itself. The silhouette, its fill and its hit-testing are wrong, and the detail line pokes out of the box. The tab depth `t` should be clamped by the width as well (for example `t ≤ w / 2`), the way `tw` already is.
- evidence: read
- severity: low

## `parseUnitD` lets path data that only moves through as "drawing something"
- where: packages/diagram/src/outlines/fromD.ts:13 (parseUnitD)
- scenario: `outlineFromD('M0.5 0.5')` (or `'M0 0M1 1'`). `pathFromD` builds one moveTo command, so `commands.length === 0` is false and nothing is reported. The outline is accepted, but it has no area to fill, stroke or pick. The doc comment promises a throw on data that "draws nothing". The check should look for a command other than a moveTo, not just for an empty command list.
- evidence: read (packages/geom/src/paths/pathFromD.ts, packages/geom/src/paths/builder.ts:158)
- severity: low

## BPMN redefines the ellipse cubic constant and the ellipse construction instead of using the shared ones
- where: packages/diagram/src/outlines/bpmn.ts:28 (KAPPA, annulus)
- scenario: bpmn.ts declares its own `KAPPA = 0.5522847498`, truncated, beside `flowchart.ts`'s exported `KAPPA = 0.5522847498307936`, which figures, storage and participants all import. Its `annulus` also redraws the ellipse by hand instead of using `ellipsePath`. The end event's outer ring is meant to sit on the ellipse that `FLOWCHART_OUTLINES.ellipse.path` (`ellipsePath`) strokes, but it now comes from a second definition, with a different constant and possibly a different start point and winding. Any change to `ellipsePath` will leave the filled ring off the stroked outline. This is one decision answered in two places.
- evidence: read
- severity: low

## The component glyph keeps its fixed size and leaves a narrow box
- where: packages/diagram/src/outlines/modeling.ts:17 (component.detail)
- scenario: a component node resized to w = 16. The glyph is placed at `left = x + w − 6 − 14 = x − 4`, and its tabs reach `left − 3 = x − 7`. The detail is stroked outside the node's bounds and its silhouette, unlike every other detail in the area (`gapOf`, `foldOf`, `offsetOf`, `markerOf`, `ringOf`), which all shrink with the box. In the same box, `content` (w/4 = 4 per side) lets rows run under the glyph.
- evidence: read
- severity: low

## `outlineFromD` checks `content`'s size but not its position
- where: packages/diagram/src/outlines/fromD.ts:35 (outlineFromD)
- scenario: `outlineFromD(d, { content: { x: NaN, y: 0, width: 0.5, height: 0.5 } })`, or `{ x: 0.8, y: 0, width: 0.5, height: 1 }`. Both pass the guard. The first gives every node a NaN content x, so the rows lay out at NaN. The second gives a content box that runs past the unit square, so rows overflow the shape, even though the outline contract says content is "the largest box rows can occupy without leaving the shape". Only the width and height are checked.
- evidence: read
- severity: low

## Files read
packages/diagram/src/outlines/bpmn.ts
packages/diagram/src/outlines/figures.ts
packages/diagram/src/outlines/flowchart.ts
packages/diagram/src/outlines/fromD.ts
packages/diagram/src/outlines/modeling.ts
packages/diagram/src/outlines/network.ts
packages/diagram/src/outlines/participants.ts
packages/diagram/src/outlines/states.ts
packages/diagram/src/outlines/storage.ts
packages/diagram/src/outlines/table.ts
packages/diagram/src/outlines/types.ts

<!-- done: 5 findings, files read: 11 -->
