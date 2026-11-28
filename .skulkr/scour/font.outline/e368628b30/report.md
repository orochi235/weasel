# font.outline: saturation

Repeated blind reviews of the area `font.outline` (15 files, 2223 lines) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: fewer than 1 defect per thousand lines estimated unseen (0.75). The next defect should cost about $1.77. `skulkr scour report font.outline` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.17 |    $0.08 |     0.2 |
|   2 | claude |        3 |   3 |        5 |   5 |   0 |       10.0 |    5.0 |   100.0% | $0.99 |    $0.23 |     2.9 |
|   3 | claude |        3 |   2 |        7 |   6 |   1 |       19.0 |   12.0 |    64.3% | $0.68 |    $0.26 |     3.1 |
|   4 | claude |        4 |   2 |        9 |   7 |   1 |       27.4 |   18.4 |    53.3% | $0.76 |    $0.29 |     3.2 |
|   5 | claude |        2 |   0 |        9 |   6 |   2 |       16.2 |    7.2 |    36.7% | $0.79 |    $0.38 |     3.4 |
|   6 | claude |        3 |   0 |        9 |   4 |   4 |       10.7 |    1.7 |    16.8% | $0.72 |    $0.46 |     3.1 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |         5 |        8 |       10.1 |    2.1 |    19.4% |       – |
| all sources    | Chao2     |         6 |        9 |       10.7 |    1.7 |    16.8% |       – |
| codex × claude | Chapman   |         – |        9 |       12.5 |    3.5 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                          | where                                                                                                                      | first | codex | claude | severity |
|-----|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | A subscriber reacting to the synchronous loading update reenters beginLoad before slot.load is set, which parses the source twice and publishes readiness twice | packages/font/src/outline/outlineRegistry.ts:277 (beginLoad)                                                               |     1 |     1 |      0 | medium   |
| D2  | CFF2 outlines (font.tables.cff2) are reported as truetype by embeddingOf, which misroutes PDF and SVG font embedding                                            | packages/font/src/outline/opentypeParser.ts:185 (embeddingOf)                                                              |     1 |     1 |      1 | medium   |
| D3  | GPOS reader's work budget never counts subtables, so a small GPOS can still hang or exhaust memory in pairSubtables                                             | packages/font/src/outline/gposKerning.ts:191 (pairSubtables)                                                               |     2 |     0 |      5 | high     |
| D4  | A .ttc whose member offsets all name one huge directory makes membersOf reread it per member, quadratic work on a damaged file                                  | packages/font/src/outline/sfnt.ts:212 (membersOf)                                                                          |     2 |     0 |      2 | medium   |
| D5  | checkCff does quadratic work when many FDArray Font DICTs share one Private DICT's Subrs INDEX, rereading it each time                                          | packages/font/src/outline/cffCheck.ts:52 (checkCff)                                                                        |     2 |     0 |      1 | low      |
| D6  | The cmap and CFF checks read a different table than opentype.js parses when a tag is listed twice or a table's length runs past the file                        | packages/font/src/outline/opentypeParser.ts:236 (createOpenTypeParser), packages/font/src/outline/sfnt.ts:63 (tableOf)     |     3 |     0 |      2 | high     |
| D7  | Pairs kerned only under a language-specific LangSys get kerned in default text                                                                                  | packages/font/src/outline/gposKerning.ts:286 (pairKerning), packages/font/src/outline/gposKerning.ts:116 (lookupIndexSets) |     3 |     0 |      1 | low      |
| D8  | GPOS ScriptList records sharing one Script table multiply LangSys iteration past the work budget                                                                | packages/font/src/outline/gposKerning.ts:124 (lookupIndexSets)                                                             |     4 |     0 |      2 | medium   |
| D9  | A WOFF's output buffer is sized from recorded table lengths, up to 1032× the file size, before any table is inflated                                            | packages/font/src/outline/woff.ts:43 (sfntFromWoff)                                                                        |     4 |     0 |      1 | low      |
