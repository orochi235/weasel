# geom.part1: saturation

Repeated blind reviews of the area `geom.part1` (42 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, or 40 occasions have run.
Not stopped yet. `skulkr saturate report geom.part1` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        4 |   4 |        4 |   4 |   0 |          – |      – |        – | $0.17 |    $0.04 |     0.2 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        4 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        4 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                               | where                                                  | first | codex | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------|------:|------:|----------|
| D1  | Inverting a finite uniform scale like 1e200 returns a zero linear matrix: the determinant overflows, its reciprocal is zero, and the conditioning check passes on the zero candidate | packages/geom/src/affine.ts:54                         |     1 |     1 | low      |
| D2  | Affine fit returns null for distinct points after a large common translation because the spread check scales with the squared absolute centroid                                      | packages/geom/src/affineFit.ts:27                      |     1 |     1 | medium   |
| D3  | meanScale returns infinity (or underflows) for large or small equal finite scales because the intermediate product overflows                                                         | packages/geom/src/meanScale.ts:16 (meanScale)          |     1 |     1 | low      |
| D4  | cubicBezierEasing returns progress far too small near a flat x endpoint because the absolute x-error threshold accepts the initial guess                                             | packages/geom/src/easingSpec.ts:48 (cubicBezierEasing) |     1 |     1 | low      |
