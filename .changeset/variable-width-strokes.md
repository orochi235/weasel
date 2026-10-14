---
'@weasel-js/paint': patch
'@weasel-js/stroke': patch
'@weasel-js/geom': patch
'@weasel-js/renderer': patch
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

A stroke's width can vary along its length. `Stroke.widthProfile` is a list of stops `{ t, width }`: at fraction `t` of each subpath's arc length, the stroke is `width` times `Stroke.width`. Between stops the width follows a monotone cubic, which passes through every stop without overshooting it; past the end stops it holds, and on a closed subpath it runs on across the seam. A profile multiplies `vertexWidths` where both are set. `@weasel-js/paint` adds `widthProfileAt`, `normalizeWidthProfile`, `setWidthStop`, `removeWidthStop`, and `widestInProfile`, with the types `WidthProfile` and `WidthStop`.

The tessellator resamples each subpath and gives every point its width, so the drawn ribbon, `strokeToPath`, joins, caps, dashes, and marker trims all follow the profile, and the renderer's ribbon cache and culling account for it. A dashed stroke now keeps per-point widths, which it used to drop for `vertexWidths` as well. `@weasel-js/stroke` adds `nearestStrokeSite` and `strokeSitesAt`, which find points along a stroke by the same measure; the anchor-parameter rule that trimming, dashing, and profiles share is `anchorParamsBetween` in `@weasel-js/geom/tessellate`.

SVG has no variable width. `serializeSvg` writes a profiled stroke's path with its stroke attributes at `stroke-width="0"`, which draws nothing, keeps the real width and the profile in the `wzl` namespace, and follows the path with the stroke's outline as a filled path in the stroke's paint. Other viewers draw the outline; `parseSvg` drops it and reads the stroke, profile included, back off the path.

`useWidthTool` (Shift+W) edits a profile on the canvas: a drag on a stroke sets its width at the point pressed, at the stop already there or a new one, to twice the pointer's distance from the centerline, previewed live and committed as one undo entry. Alt-click removes the stop under the pointer. The stroke last touched shows its stops. Picking reaches as far as a profile's widest point.
