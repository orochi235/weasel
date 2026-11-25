## An unregistered outline name falls back to the built-in `rect`, ignoring a registered `rect` that shadows it
- where: packages/diagram/src/outlines/table.ts:54 (resolveOutline)
- scenario: a consumer calls `registerOutline('rect', myRect)` to restyle plain boxes (the table explicitly supports shadowing a built-in). A node saved with an outline name that is not registered (`'cylindr'`, or a name from a plugin not loaded) resolves to `FLOWCHART_OUTLINES.rect`, the kit's original, not `myRect`. So `outline: 'rect'` and the fallback paint two different shapes, although the README ("A saved name that is not registered paints as `'rect'`") and the warning text ("painting it as 'rect'") say they are the same. Should return `table.get('rect') ?? FLOWCHART_OUTLINES.rect`.
- evidence: read
- severity: low

## `roundRectOutline(Infinity)` (or any large radius) sizes a node to an infinite or far-oversized box
- where: packages/diagram/src/outlines/figures.ts:39 (roundRectOutline, boxForContent)
- scenario: `path` and `content` clamp the radius to a sixth of the shorter side (`radiusOf`), so `roundRectOutline(Infinity)` is a valid "as round as the box allows" outline that draws fine. But `boxForContent` adds `maxRadius * BITE * 2` unclamped, so sizing a node to its rows returns `{ width: Infinity, height: Infinity }`; `roundRectOutline(200)` for 50×20 content returns ~167×137 where the drawn radius (≤ 1/6 of the side) needs only a few px of margin. A negative `maxRadius` (clamped to 0 in `radiusOf`) makes the box *smaller* than the content, breaking the "content is at least `content`" contract. The inverse should solve against the same clamp: e.g. margin = `2·BITE·min(maxRadius, side/6)` solved for the side, or `max(0, maxRadius)` at least.
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
