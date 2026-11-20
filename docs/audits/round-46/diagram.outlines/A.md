# Audit round 46 — diagram.outlines

## `outlineFromD` accepts path data that doesn't parse and builds an outline with an empty silhouette, while a mark's `d` with the same data throws
- where: packages/diagram/src/outlines/fromD.ts:11-12 (outlineFromD)
- scenario: `pathFromD` is called with no `onWarn`, so `registerOutline('tag', outlineFromD('0 0 L1 0 L1 1Z'))` (no leading moveto), or data with an unknown command or a wrong argument count, quietly gives an empty or truncated path. Every node using that outline then paints no fill or stroke and has no silhouette to pick or clip by, and nothing reports it. The `detail` string is handled the same way. The package makes the opposite decision for marks: `marks.ts:60` passes an `onWarn` to `pathFromD`, and the README says `diagramScene` "throws on path data that does not parse or draws nothing". The same unit-square path-data input gets two different answers. Expected: `outlineFromD` should throw (or at least report) on data that `pathFromD` warns about or that builds an empty path, the way marks do. A degenerate `content` (`width: 0` or `height: 0`) also gets through unchecked, and `boxForContent` (line 23) then returns Infinity/NaN.
- evidence: read
- severity: medium

## `roundRectOutline`'s `boxForContent` uses the raw `maxRadius` where its path and content clamp it, so it breaks the inverse for a non-finite or negative radius
- where: packages/diagram/src/outlines/figures.ts:39 (roundRectOutline, boxForContent)
- scenario: `roundRectOutline` is public (`packages/diagram/src/index.ts:380`) and its doc says the radius is `maxRadius` "or a sixth of the shorter side when that is less", so `roundRectOutline(Infinity)` is a natural way to ask for "always a sixth". `radiusOf` clamps it to `min(w/6, h/6)` and path/content are fine, but `boxForContent` returns `c.width + Infinity * BITE * 2`, an Infinity-sized box. `body.ts:199` and `sequence/metrics.ts:77` then size a node to that box. A negative radius (`roundRectOutline(-4)`) has the opposite problem: `radiusOf` clamps it to 0, so content = bounds, but `boxForContent` returns `c - 8·BITE`, a box *smaller* than the content it was asked to fit, which contradicts "a box whose content is at least `content`" (types.ts:21). Expected: `boxForContent` should use the same clamped radius `radiusOf` does (it only needs the upper bound, `Math.max(0, maxRadius)`, plus a finite check), or `roundRectOutline` should reject a radius that isn't finite and non-negative.
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

<!-- done: 2 findings, files read: 11 -->
