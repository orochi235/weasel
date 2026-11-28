# text.layout: saturation

Repeated blind reviews of the area `text.layout` (31 files, 4610 lines) at the frozen commit
`471ca1528c`, with no fixes between them, from `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: the next defect would cost about $1.50, over the limit of $1.49 (3× the $0.50 going rate). The next defect should cost about $1.50. `skulkr scour report text.layout` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | claude |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $2.36 |    $0.79 |     6.3 |
|   2 | claude |        6 |   5 |        8 |   7 |   1 |       20.3 |   12.3 |    60.5% | $2.71 |    $0.63 |     7.4 |
|   3 | claude |        3 |   2 |       10 |   9 |   0 |       34.0 |   24.0 |    75.0% | $1.74 |    $0.68 |     7.7 |
|   4 | claude |        3 |   2 |       12 |  10 |   1 |       49.5 |   37.5 |    62.5% | $2.95 |    $0.81 |    13.9 |
|   5 | claude |        1 |   0 |       12 |   9 |   2 |       28.2 |   16.2 |    50.6% | $1.55 |    $0.94 |     6.6 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| claude      | Chao2     |         5 |       12 |       28.2 |   16.2 |    50.6% |       – |
| all sources | Chao2     |         5 |       12 |       28.2 |   16.2 |    50.6% |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                   | where                                                                                                                                      | first | claude | severity |
|-----|------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|------:|-------:|----------|
| D1  | Line-breaking and measuring scratch grows to the longest text ever laid out and keeps its entries alive                                  | packages/text/src/layout/layoutLines.ts:83 (module `sum`, `tabs`, `broken`), packages/text/src/layout/layoutRuns.ts:200 (`ENTRIES`, `CPS`) |     1 |      3 | low      |
| D2  | A blank line in a right-to-left paragraph aligns as left-to-right under `direction: 'auto'`                                              | packages/text/src/layout/layoutRuns.ts:244 (layoutRuns, `reads`)                                                                           |     1 |      2 | low      |
| D3  | Justify widens only U+0020, so gaps of no-break space stay narrow                                                                        | packages/text/src/layout/layoutLines.ts:228 (wordGaps)                                                                                     |     1 |      1 | low      |
| D4  | LB20a does not hold a word-initial hyphen before a Hebrew letter                                                                         | packages/text/src/layout/lineBreak/lineBreaks.ts:186 (decide)                                                                              |     2 |      1 | low      |
| D5  | Recycled LayoutColumns in the spare pool keep every line box of the layout they held alive                                               | packages/text/src/layout/layoutColumns.ts:93 (LayoutColumns.recycle)                                                                       |     2 |      2 | low      |
| D6  | The array pool never evicts, so sizes nobody requests again fill it and block it permanently                                             | packages/text/src/layout/arrayPool.ts:48 (give)                                                                                            |     2 |      1 | low      |
| D7  | The RTL-without-engine warning misses N'Ko, Samaritan and Mandaic                                                                        | packages/text/src/layout/bidiRegistry.ts:68 (RTL_BLOCKS)                                                                                   |     2 |      1 | low      |
| D8  | The shaping-without-engine warning misses Mandaic                                                                                        | packages/text/src/layout/shaperRegistry.ts:83 (SHAPED_BLOCKS)                                                                              |     2 |      1 | low      |
| D9  | evictRunsForRefill blanks only the last structural entry a runs array filled, so other entries keep comparing against the refilled array | packages/text/src/layout/layoutCache.ts:270 (evictRunsForRefill)                                                                           |     3 |      1 | medium   |
| D10 | registerTallFont leaves global.fetch stubbed when the registration throws                                                                | packages/text/src/layout/testing/fontFixtures.ts:39 (registerTallFont)                                                                     |     3 |      1 | low      |
| D11 | evictRuns leaves the entry's painting keyed on the runs it drops, so a later key built from a refilled array can match stale painting    | packages/text/src/layout/layoutCache.ts:221 (evictRuns)                                                                                    |     4 |      1 | low      |
| D12 | The array pool never deletes an emptied bucket, so its map grows with every distinct length ever handed back                             | packages/text/src/layout/arrayPool.ts:39 (take / give)                                                                                     |     4 |      1 | low      |
