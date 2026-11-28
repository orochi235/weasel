# geom.part2: saturation

Repeated blind reviews of the area `geom.part2` (41 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report geom.part2` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        4 |   4 |        4 |   4 |   0 |          – |      – |        – | $0.17 |    $0.04 |     0.1 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        4 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        4 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                | where                                                    | first | codex | severity |
|-----|---------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------|------:|------:|----------|
| D1  | A JSON-compatible object whose toJSON returns itself overflows the tagger stack (RangeError) because toJSON is reinvoked indefinitely | packages/geom/src/typedArrayJson.ts:126 (tagTypedArrays) |     1 |     1 | medium   |
| D2  | A zero-length arc or ellipse slice collapses to the original center instead of the selected station on the curve                      | packages/geom/src/track/slice.ts:21                      |     1 |     1 | medium   |
| D3  | Squared-distance overflow makes cubic nearest-point search return the wrong point when candidates all compare as infinity             | packages/geom/src/nearest.ts:62                          |     1 |     1 | low      |
| D4  | Squared pixel-radius comparison overflows to Infinity vs Infinity and accepts a point outside the radius                              | packages/geom/src/pxExtent.ts:74 (withinPxRadius)        |     1 |     1 | low      |
