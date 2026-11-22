# Audit round 68 — symmetry

## A handle press takes the first handle in reach, not the nearest, so the center cannot be grabbed once a step or row handle sits within the hit radius of it
- where: packages/symmetry/src/guide.ts:192 (createSymmetryGuideLayer → hitTest), with the order from guideHandles at :66–74
- scenario: a `repeat` or `wallpaper` group with `spacing` 120 viewed at scale 0.07 (step handle 8.4 px from the center), or any small `spacing`/`rowSpacing` at normal zoom. `guideHandles` lists `step` (and `row`) before `center`, and `hitTest` returns the first handle within `hitR` (9 px). A press dead on the center dot therefore returns `handle: 'step'`, and the drag rewrites `angle`/`spacing` (spacing clamped to ≥ 1) instead of moving the center. The center handle is unreachable at that zoom, even though it is drawn on top only in the sense of draw order; the press should go to the nearest handle in reach (or the center should win on its own dot).
- evidence: read
- severity: medium

## A repeat's guide line is drawn on the wrong side of the center when its spacing is negative
- where: packages/symmetry/src/guide.ts:164 (createSymmetryGuideLayer → draw, `across(spec.angle, faint, true)`)
- scenario: `{ kind: 'repeat', angle: 0, spacing: -120, count: 4 }` (negative spacing is valid input — `SYMMETRY_KINDS.repeat.transforms` steps by `cos(angle) * spacing`, and the PBT fixture generates it). The copies, the guide's dots and the step handle all land at −x, but the faint half-line is drawn from the center toward +x, where nothing is. The half-line should follow the sign of `spacing` (direction `angle + π` when it is negative).
- evidence: read
- severity: low

## The angle knob's reach ignores the copies of a symmetry group nested inside the active one
- where: packages/symmetry/src/frames.ts:52 (reachFrom)
- scenario: the active group is a `mirror` holding a nested `repeat` group whose original sits near the outer center and whose copies step 600 world units out. `reachFrom` walks only stored descendants, so `reach` is the nested original's corner, and the knob (placed at `reach` + 2·hitR along the axis) lands on top of the nested group's copies — the case the reach exists to prevent. The doc's justification ("A symmetry's copies turn and reflect about `center`, so they reach no further") holds for the active group's own copies, not for a nested group's, which are about its own center and may be translations.
- evidence: read
- severity: low

## Files read
packages/symmetry/src/bake.ts
packages/symmetry/src/controller.ts
packages/symmetry/src/frames.ts
packages/symmetry/src/group.ts
packages/symmetry/src/guide.ts
packages/symmetry/src/handleDrag.ts
packages/symmetry/src/index.ts
packages/symmetry/src/kinds.ts
packages/symmetry/src/pbt.fixture.ts
packages/symmetry/src/settings.ts
packages/symmetry/src/wallpaper.ts

<!-- done: 3 findings, files read: 11 -->
