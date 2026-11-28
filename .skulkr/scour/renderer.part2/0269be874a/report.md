# renderer.part2: saturation

Repeated blind reviews of the area `renderer.part2` (38 files, 3785 lines) at the frozen commit
`0269be874a`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 6.6 known defects per thousand lines, at least 5. The next defect should cost about $1.76. `skulkr scour report renderer.part2` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.18 |    $0.09 |     0.2 |
|   2 | claude |        6 |   6 |        8 |   8 |   0 |       22.0 |   14.0 |   100.0% | $1.63 |    $0.23 |     4.7 |
|   3 | claude |        3 |   2 |       10 |   9 |   1 |       37.0 |   27.0 |    73.6% | $1.47 |    $0.33 |     5.6 |
|   4 | claude |        1 |   0 |       10 |   8 |   2 |       22.0 |   12.0 |    57.1% | $1.34 |    $0.46 |     5.4 |
|   5 | claude |        2 |   2 |       12 |  10 |   2 |       32.0 |   20.0 |    64.9% | $1.09 |    $0.48 |     4.4 |
|   6 | claude |        4 |   3 |       15 |  13 |   1 |       85.4 |   70.4 |    70.1% | $1.18 |    $0.46 |     4.7 |
|   7 | claude |        2 |   2 |       17 |  15 |   1 |      113.4 |   96.4 |    73.4% | $0.99 |    $0.46 |     3.7 |
|   8 | claude |        1 |   0 |       17 |  14 |   2 |       59.9 |   42.9 |    64.1% | $1.73 |    $0.57 |     6.0 |
|   9 | claude |        4 |   2 |       19 |  14 |   4 |       40.8 |   21.8 |    52.3% | $0.87 |    $0.55 |     3.9 |
|  10 | claude |        2 |   0 |       19 |  13 |   4 |       38.0 |   19.0 |    45.1% | $0.96 |    $0.60 |     3.8 |
|  11 | claude |        2 |   1 |       20 |  14 |   3 |       49.7 |   29.7 |    46.3% | $0.75 |    $0.61 |     2.9 |
|  12 | claude |        3 |   1 |       21 |  13 |   5 |       36.5 |   15.5 |    38.0% | $1.09 |    $0.63 |     5.3 |
|  13 | claude |        2 |   1 |       22 |  13 |   6 |       35.0 |   13.0 |    35.5% | $1.28 |    $0.66 |     5.0 |
|  14 | claude |        4 |   0 |       22 |  13 |   3 |       48.2 |   26.2 |    33.0% | $0.83 |    $0.70 |     3.6 |
|  15 | claude |        3 |   0 |       22 |  12 |   3 |       44.4 |   22.4 |    28.3% | $1.45 |    $0.77 |     5.3 |
|  16 | claude |        3 |   2 |       24 |  13 |   4 |       43.8 |   19.8 |    28.4% | $1.03 |    $0.75 |     4.3 |
|  17 | claude |        2 |   1 |       25 |  14 |   4 |       48.1 |   23.1 |    28.8% | $1.91 |    $0.79 |     7.1 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |        16 |       23 |       39.9 |   16.9 |    25.5% |       – |
| all sources    | Chao2     |        17 |       25 |       48.1 |   23.1 |    28.8% |       – |
| codex × claude | Chapman   |         – |       25 |       71.0 |   46.0 |        – |       0 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                              | where                                                                                              | first | codex | claude | severity |
|-----|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Async readback decodes with width/height from the caller's mutable rect instead of the checked copy, misordering rows or throwing if the rect changes before settle | packages/renderer/src/readPixels.ts:26                                                             |     1 |     1 |      0 | medium   |
| D2  | Failed scratch resize leaves the already-deleted target cached in the scratch field, so a later bake reuses it and cleanup double-deletes it                        | packages/renderer/src/retain/TileTextures.ts:58 (scratchFor)                                       |     1 |     1 |      0 | medium   |
| D3  | chunks tile scattering stops at the first chunk that covers the tile, so every later chunk is dropped                                                               | packages/renderer/src/patterns/tileGeometry.ts:89 (tileGeometry, `chunks` case)                    |     2 |     0 |      2 | low      |
| D4  | TileTextures.release never evicts from the tile's own size bucket, even when that size was the one freed into longest ago                                           | packages/renderer/src/retain/TileTextures.ts:96 (release)                                          |     2 |     0 |      1 | low      |
| D5  | createTilePattern rejects a size below 1, though its options say sizes are rounded to whole pixels                                                                  | packages/renderer/src/patterns/rasterizeTile.ts:6 (rasterizeTile)                                  |     2 |     0 |      3 | low      |
| D6  | cullToTile builds new group objects and children arrays for every tile on every redraw, so caches keyed on array identity always miss                               | packages/renderer/src/retain/tileCull.ts:55 (cullToTile)                                           |     2 |     0 |      1 | low      |
| D7  | commandsBounds adds cull slack measured in CSS pixels in whatever units its transform maps into                                                                     | packages/renderer/src/retain/contentBounds.ts:99 (commandsBounds)                                  |     2 |     0 |      1 | low      |
| D8  | _resetPaintDrawKindsForTests leaves the programs of registered kinds in the program registry                                                                        | packages/renderer/src/paintKinds.ts:371 (_resetPaintDrawKindsForTests)                             |     2 |     0 |      1 | low      |
| D9  | A displaced loader's failed load rejects warmPaintKinds even though the live loader would load the kind                                                             | packages/renderer/src/paintKinds.ts:303 (startLoad)                                                |     3 |     0 |      2 | low      |
| D10 | textBoxOf spreads every line into Math.min, which throws on very long text                                                                                          | packages/renderer/src/textCommand.ts:174 (textBoxOf)                                               |     3 |     0 |      4 | low      |
| D11 | shaderBox bounds a custom shader from its GLSL alone, so a WGSL program with its own vertex stage is under-bounded on WebGPU                                        | packages/renderer/src/paintedBounds.ts:61 (shaderBox)                                              |     5 |     0 |      1 | medium   |
| D12 | A paint-kind loader that throws synchronously escapes getPaintDrawKind on every lookup                                                                              | packages/renderer/src/paintKinds.ts:316 (startLoad)                                                |     5 |     0 |      2 | low      |
| D13 | A 'bounds' paint of a lazily loaded kind passes through unconverted until the kind loads, and memoized commands keep the unconverted paint                          | packages/renderer/src/paintToLocalUnits.ts:24 (paintToLocalUnits), :58 (paintToBoundsUnits)        |     6 |     0 |      4 | medium   |
| D14 | A second paint-kind loader declared after the first loader's kind has loaded is never called, contrary to its doc                                                   | packages/renderer/src/paintKinds.ts:248 (registerPaintDrawKindLoader doc), :220 (getPaintDrawKind) |     6 |     0 |      1 | low      |
| D15 | A revived pattern tile can differ from the original because the JSON round-trip turns NaN and Infinity fields into null                                             | packages/renderer/src/patterns/resolveSpec.ts:45 (specId), :117 (revive)                           |     6 |     0 |      3 | low      |
| D16 | frameRect returns NaN rects for a sheet with columns: 0, and a negative or fractional index yields a rect off the grid                                              | packages/renderer/src/spriteSheet.ts:38 (frameRect)                                                |     7 |     0 |      1 | low      |
| D17 | warmPaintKinds resolves without the kind registered when its loader is disposed while the load is in flight                                                         | packages/renderer/src/paintKinds.ts:300 (startLoad)                                                |     7 |     0 |      3 | low      |
| D18 | An empty group running an unbounded effect is bounded as empty, so culling drops it                                                                                 | packages/renderer/src/paintedBounds.ts:63 (grown), via commandBox :35                              |     9 |     0 |      4 | low      |
| D19 | The chunks tile caps its count at s², which still hangs on a large tile                                                                                             | packages/renderer/src/patterns/tileGeometry.ts:83 (tileGeometry, chunks)                           |     9 |     0 |      4 | low      |
| D20 | getPaintDrawKind never starts a loader whose `has` answers for its own registry when the kind's draw half is registered elsewhere                                   | packages/renderer/src/paintKinds.ts:250 (getPaintDrawKind)                                         |    11 |     0 |      1 | low      |
| D21 | A 'bounds' conic gradient keeps its angle unchanged when mapped onto a non-square box, so its sweep is skewed                                                       | packages/renderer/src/paintToLocalUnits.ts:47 (paintToLocalUnits), :79 (paintToBoundsUnits)        |    12 |     0 |      1 | low      |
| D22 | A paint-kind loader whose load fails while another loader displaces it is never retried after it becomes the live loader again                                      | packages/renderer/src/paintKinds.ts:296 (startLoad)                                                |    13 |     0 |      2 | low      |
| D23 | getPaintDrawKind starts a loader's load even when that loader's own `has` reports the kind is not needed                                                            | packages/renderer/src/paintKinds.ts:228 (getPaintDrawKind)                                         |    16 |     0 |      1 | low      |
| D24 | Reviving an evicted pattern tile bypasses the failed-rasterize memo, so a failing tile retries canvas rasterization on every draw                                   | packages/renderer/src/patterns/resolveSpec.ts:118 (revive)                                         |    16 |     0 |      1 | low      |
| D25 | A tile paint's size has no upper bound, so a very large size allocates a canvas of that size when the tile is rasterized                                            | packages/renderer/src/patterns/rasterizeTile.ts:5 (rasterizeTile)                                  |    17 |     0 |      1 | low      |
