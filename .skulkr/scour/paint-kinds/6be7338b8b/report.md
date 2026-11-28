# paint-kinds: saturation

Repeated blind reviews of the area `paint-kinds` (13 files, 603 lines) at the frozen commit
`6be7338b8b`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 16.6 known defects per thousand lines, at least 5. The next defect should cost about $0.50. `skulkr scour report paint-kinds` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.17 |    $0.06 |     0.2 |
|   2 | claude |        2 |   2 |        5 |   5 |   0 |       10.0 |    5.0 |   100.0% | $1.12 |    $0.26 |     1.8 |
|   3 | claude |        2 |   2 |        7 |   7 |   0 |       21.0 |   14.0 |   100.0% | $1.14 |    $0.35 |     1.9 |
|   4 | claude |        2 |   2 |        9 |   9 |   0 |       36.0 |   27.0 |   100.0% | $0.73 |    $0.35 |     1.7 |
|   5 | claude |        2 |   1 |       10 |   9 |   1 |       42.4 |   32.4 |    77.5% | $0.77 |    $0.39 |     1.8 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        3 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |        8 |       29.0 |   21.0 |   100.0% |       – |
| all sources    | Chao2     |         5 |       10 |       42.4 |   32.4 |    77.5% |       – |
| codex × claude | Chapman   |         – |       10 |       17.0 |    7.0 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                          | where                                                                                                                                | first | codex | claude | severity |
|-----|-------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Removal notifies subscribers before dropDraw, so editor and draw registrations disagree inside the notification                                 | packages/paint-kinds/src/paintKinds.ts:152                                                                                           |     1 |     1 |      0 | low      |
| D2  | Declaring a loader never notifies paintKindRegistry, so a mounted usePaintKind for that id never loads it                                       | packages/paint-kinds/src/paintKinds.ts:173                                                                                           |     1 |     1 |      0 | low      |
| D3  | Gradient colorOf takes the first duplicate start stop while sampling takes the last, seeding the wrong color                                    | packages/paint-kinds/src/paintKinds.ts:98 (colorOf)                                                                                  |     1 |     1 |      1 | low      |
| D4  | seedTile('chunks', …) seeds a fully transparent ground, so the ground the comment requires is never present                                     | packages/paint-kinds/src/paintKinds.ts:79 (seedTile)                                                                                 |     2 |     0 |      1 | low      |
| D5  | nativeSvgKind decides by kind name, so an override of a native kind registered with registerPaintKind is never serialized through its own toSvg | packages/paint-kinds/src/svgNative.ts:11 (nativeSvgKind)                                                                             |     2 |     0 |      1 | low      |
| D6  | Gradient seed treats only exact white as white, so a near-white color seeds an invisible white-to-white ramp                                    | packages/paint-kinds/src/paintKinds.ts:105 (twoStopRamp)                                                                             |     3 |     0 |      1 | low      |
| D7  | The image and texture entries' seed returns a hatch paint, which breaks the seed contract                                                       | packages/paint-kinds/src/paintKinds.ts:44 (BUILTINS image/texture seed)                                                              |     3 |     0 |      1 | low      |
| D8  | A mesh paint missing `patches` or a gradient missing `stops` makes withPaintKind throw, while colorOf on the same paint tolerates the gap       | packages/paint-kinds/src/meshKind.ts:25 (meshGradientKind.stopsOf); packages/paint-kinds/src/paintKinds.ts:89 (gradientKind stopsOf) |     4 |     0 |      1 | low      |
| D9  | Mesh kind's colorOf reads the first patch even when the renderer skips that patch as invalid                                                    | packages/paint-kinds/src/meshKind.ts:23 (meshGradientKind.colorOf)                                                                   |     4 |     0 |      1 | low      |
| D10 | derivedList duplicates registry's createValuesReader instead of using it                                                                        | packages/paint-kinds/src/paintKinds.ts:190 (derivedList / allKinds)                                                                  |     5 |     0 |      1 | low      |
