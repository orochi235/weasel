# core.core.viewport: saturation

Repeated blind reviews of the area `core.core.viewport` (23 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `claude`, `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, or 40 occasions have run.
Stopped: the next occasion's chance of a new finding is under 15% (9.0%). `skulkr scour report core.core.viewport` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | claude |        4 |   4 |        4 |   4 |   0 |          – |      – |        – | $0.85 |    $0.21 |     2.0 |
|   2 | claude |        7 |   5 |        9 |   7 |   2 |       15.1 |    6.1 |    40.5% | $0.92 |    $0.20 |     2.0 |
|   3 | claude |        4 |   2 |       11 |   7 |   4 |       15.1 |    4.1 |    29.7% | $0.44 |    $0.20 |     1.0 |
|   4 | claude |        2 |   0 |       11 |   7 |   2 |       20.2 |    9.2 |    34.6% | $0.58 |    $0.25 |     2.0 |
|   5 | claude |        5 |   2 |       13 |   8 |   2 |       25.8 |   12.8 |    32.3% | $0.51 |    $0.25 |     2.0 |
|   6 | claude |        3 |   2 |       15 |  10 |   2 |       35.8 |   20.8 |    37.0% | $1.15 |    $0.30 |     3.0 |
|   7 | claude |        3 |   2 |       17 |  12 |   2 |       47.9 |   30.9 |    40.6% | $0.82 |    $0.31 |     3.0 |
|   8 | claude |        2 |   0 |       17 |  12 |   2 |       48.5 |   31.5 |    38.2% | $0.67 |    $0.35 |     2.0 |
|   9 | claude |        2 |   0 |       17 |  11 |   3 |       34.9 |   17.9 |    32.2% | $0.50 |    $0.38 |     2.0 |
|  10 | claude |        3 |   0 |       17 |   9 |   4 |       26.1 |    9.1 |    23.4% | $0.72 |    $0.42 |     1.0 |
|  11 | claude |        4 |   1 |       18 |   9 |   5 |       25.4 |    7.4 |    20.8% | $0.54 |    $0.43 |     1.0 |
|  12 | claude |        3 |   0 |       18 |   9 |   4 |       27.3 |    9.3 |    19.8% | $0.29 |    $0.44 |     1.0 |
|  13 | claude |        3 |   0 |       18 |   8 |   5 |       23.9 |    5.9 |    16.1% | $0.65 |    $0.48 |     2.0 |
|  14 | claude |        3 |   0 |       18 |   7 |   5 |       22.6 |    4.5 |    12.9% | $0.82 |    $0.53 |     2.0 |
|  15 | claude |        5 |   2 |       20 |   9 |   5 |       27.6 |    7.6 |    15.4% | $0.55 |    $0.50 |     2.0 |
|  16 | claude |        4 |   1 |       21 |  10 |   4 |       32.7 |   11.7 |    16.4% | $0.50 |    $0.50 |     1.0 |
|  17 | claude |        5 |   0 |       21 |   9 |   5 |       28.6 |    7.6 |    13.4% | $0.52 |    $0.53 |     2.0 |
|  18 | claude |        4 |   0 |       21 |   9 |   5 |       28.6 |    7.7 |    12.6% | $0.41 |    $0.54 |     1.0 |
|  19 | claude |        3 |   0 |       21 |   9 |   4 |       30.6 |    9.6 |    12.3% | $0.46 |    $0.57 |     1.0 |
|  20 | claude |        3 |   0 |       21 |   8 |   5 |       27.1 |    6.1 |    10.3% | $0.45 |    $0.59 |     1.0 |
|  21 | claude |        3 |   1 |       22 |   9 |   5 |       29.7 |    7.7 |    11.2% | $0.55 |    $0.59 |     1.0 |
|  22 | claude |        2 |   0 |       22 |   9 |   5 |       29.7 |    7.7 |    11.0% | $0.51 |    $0.61 |     1.0 |
|  23 | codex  |       13 |   5 |       27 |   9 |  10 |       30.9 |    3.9 |     9.0% | $0.20 |    $0.50 |     0.3 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| claude         | Chao2     |        22 |       22 |       29.7 |    7.7 |    11.0% |       – |
| codex          | Chao2     |         1 |       13 |          – |      – |        – |       – |
| all sources    | Chao2     |        23 |       27 |       30.9 |    3.9 |     9.0% |       – |
| claude × codex | Chapman   |         – |       27 |       34.8 |    7.8 |        – |       8 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                                            | where                                                | first | claude | codex | severity |
|-----|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------|------:|-------:|------:|----------|
| D1  | A parallax plane with `zoom` above 1 collapses to the zoom floor (and its pointer map blows up) once the camera zooms out to `1 - 1/f` or below: its scale is tracked linearly (Codex V5)         | `parallax.ts` (`trackZoom`)                          |     1 |     14 |     1 | medium   |
| D2  | `sceneNodeClientRect`'s doc says a rect pose is its own AABB, but a rotated or transformed pose passed through anchors to the unrotated box                                                       | `sceneNodeClientRect.ts`                             |     1 |      9 |     0 | medium   |
| D3  | A zero-area viewport is handled two ways: `fitViewToBounds` keeps the view, `fitSize` fits into a 1px box and zooms all the way out                                                               | `fitSize.ts` (`fitSize`)                             |     1 |      2 |     0 | low      |
| D4  | A decay that starts outside the bounds with a `boundary` set jumps to the bound in one frame (and halves its velocity), because the clamp checks position, not crossing                           | `useDecayLoop.ts` (`tick`)                           |     1 |     15 |     0 | low      |
| D5  | `fitViewToBounds` accepts a framed rect and ignores its rotation and transform                                                                                                                    | `fitViewToBounds.ts`                                 |     2 |      6 |     0 | medium   |
| D6  | `animateToBounds` into a zero-area viewport calls `onDone` while the runner's previous animation keeps moving the camera                                                                          | `useViewAnimation.ts` (`animateToBounds`)            |     2 |      3 |     0 | low      |
| D7  | A camera animation on a shared animator outlives the component that started it (Codex V10)                                                                                                        | `useViewAnimation.ts` (`useViewAnimationOn`)         |     2 |      3 |     1 | low      |
| D8  | The decay loop's own `posX`/`posY` drift from the real view when anything else moves it mid-coast, so its bounds checks go wrong (Codex V8)                                                       | `useDecayLoop.ts` (`tick`)                           |     2 |      5 |     1 | low      |
| D9  | `getVelocity(now)` reports zero for a pointer still moving when only one sample falls in the window (Codex V7)                                                                                    | `createVelocityTracker.ts` (`getVelocity`)           |     2 |      1 |     1 | low      |
| D10 | An animation's `interpolateView` at t=1 does not land exactly on the target scale                                                                                                                 | `interpolateView.ts` (`axisCurve`)                   |     3 |      2 |     0 | low      |
| D11 | `widenSlop` converts a world slop at scale 1 when handed a flipped (negative) scale (Codex V6)                                                                                                    | `screenSlop.ts` (`widenSlop`)                        |     3 |      1 |     1 | low      |
| D12 | A new `start`, or `cancel`, drops the coast in flight without calling its `onEnd`                                                                                                                 | `useDecayLoop.ts` (`cancel`, `start`)                |     5 |      2 |     0 | low      |
| D13 | Swapping the animator under `useViewAnimationOn` mid-tween leaves the old animator's tween running: `stop` and the next `animate` cancel on the new one, and `isAnimating` says false (Codex V11) | `useViewAnimation.ts` (`cancel`, `isAnimating`)      |     5 |      1 |     1 | low      |
| D14 | `useNodeOverlayFrame` never subscribes to the scene, so its box (and whether it is null) goes stale after a scene edit (Codex V13)                                                                | `useNodeOverlayFrame.ts`                             |     6 |      1 |     1 | medium   |
| D15 | `fitViewToBounds` warns on every call into a zero-area viewport, in production too                                                                                                                | `fitViewToBounds.ts`                                 |     6 |      1 |     0 | low      |
| D16 | `useDecayLoop` given `viewBounds` without `initialPosition` clamps against the origin                                                                                                             | `useDecayLoop.ts` (`start`)                          |     7 |      4 |     0 | low      |
| D17 | Under an unbounded clamp, a zoom whose product overflows lands at `ZOOM_FLOOR` instead of staying zoomed in (Codex V1)                                                                            | `zoomAt.ts` (`clampScale`), `fitSize.ts` (`fitZoom`) |     7 |      1 |     1 | low      |
| D18 | `normalizeView` turns a `-Infinity` scale axis into a positive one, flipping a y-up camera                                                                                                        | `view.ts` (`normalizeAxis`)                          |    11 |      2 |     0 | low      |
| D19 | Fitting finite bounds into finite host dimensions can return a non-finite camera position (the final center subtraction overflows) (Codex V2) (found only by codex)                               | `fitViewToBounds.ts`                                 |    23 |      0 |     1 | low      |
| D20 | An overflowing visible span installs a non-finite position (or `NaN` on a flipped axis) after canvas view normalization (Codex V3) (found only by codex)                                          | `clampView.ts`                                       |    23 |      0 |     1 | low      |
| D21 | A node's width disappears from its client rect far from the world origin, because `x + width` rounds before projection (Codex V4) (found only by codex)                                           | `sceneNodeClientRect.ts`                             |    23 |      0 |     1 | low      |
| D22 | A large, finite zoom-out ratio (1e9 to 1e-9) makes the interpolation axis `NaN` (Codex V9) (found only by codex)                                                                                  | `interpolateView.ts` (`axisCurve`)                   |    23 |      0 |     1 | medium   |
| D23 | The overlay treats an infinite live scale as invertible and can replace its last valid mapping with it (Codex V12) (found only by codex)                                                          | `useNodeOverlayFrame.ts`                             |    23 |      0 |     1 | low      |
| D24 | A coast's stop speed is compared in world units, so how long a fling coasts on screen depends on the zoom                                                                                         | `useDecayLoop.ts` (`tick`)                           |    15 |      1 |     0 | low      |
| D25 | `fitViewToBounds` turns a `NaN` viewport dimension into a `NaN` view instead of the zero-area fallback                                                                                            | `fitViewToBounds.ts`                                 |    15 |      2 |     0 | low      |
| D26 | `fitSize` accepts a `fill` outside (0, 1] and quietly returns the minimum zoom                                                                                                                    | `fitSize.ts` (`fitSize`)                             |    16 |      1 |     0 | low      |
| D27 | The invalid-view warning says a view's zoom is "always positive", contradicting the flipped-axis invariant                                                                                        | `zoomBounds.ts` (`warnInvalidView`)                  |    21 |      1 |     0 | low      |
