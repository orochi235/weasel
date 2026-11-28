# apps.theme-editor: saturation

Repeated blind reviews of the area `apps.theme-editor` (5 files, 266 lines) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.97, or 40 occasions have run.
Stopped: ready to fix: 26.3 known defects per thousand lines, at least 5. The next defect should cost about $0.54. `skulkr scour report apps.theme-editor` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.16 |    $0.08 |     0.1 |
|   2 | claude |        2 |   2 |        4 |   4 |   0 |        7.0 |    3.0 |   100.0% | $0.64 |    $0.20 |     0.9 |
|   3 | claude |        2 |   0 |        4 |   2 |   2 |        4.7 |    0.7 |    16.7% | $0.32 |    $0.28 |     0.6 |
|   4 | claude |        3 |   2 |        6 |   3 |   2 |        7.7 |    1.7 |    20.8% | $0.36 |    $0.25 |     0.9 |
|   5 | claude |        3 |   1 |        7 |   4 |   1 |       13.4 |    6.4 |    27.4% | $0.33 |    $0.26 |     0.6 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |        7 |       14.5 |    7.5 |    45.5% |       – |
| all sources    | Chao2     |         5 |        7 |       13.4 |    6.4 |    27.4% |       – |
| codex × claude | Chapman   |         – |        7 |        7.0 |    0.0 |        – |       2 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                         | where                                                             | first | codex | claude | severity |
|-----|----------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | LEGO RGB parser checks the fields are digits but not their 0–255 range, so it emits an invalid hex color such as #3e72850                                      | apps/theme-editor/scripts/brand-colors.mjs:69                     |     1 |     1 |      1 | low      |
| D2  | Outputs are written one after another with no atomicity, so a failed Copic write leaves the LEGO table already replaced and the outputs at different revisions | apps/theme-editor/scripts/gen-brand-colors.mjs:35                 |     1 |     1 |      3 | low      |
| D3  | decodeEntities throws a bare RangeError on an out-of-range numeric character reference instead of its own named error                                          | apps/theme-editor/scripts/brand-colors.mjs:49 (decodeEntities)    |     2 |     0 |      3 | low      |
| D4  | decodeEntities matches named entity references case-insensitively but looks them up case-sensitively, so mixed-case names fail to decode                       | apps/theme-editor/scripts/brand-colors.mjs:47-51 (decodeEntities) |     2 |     0 |      1 | low      |
| D5  | parseCopic drops a marker whose `number` is numeric 0 (falsy check)                                                                                            | apps/theme-editor/scripts/brand-colors.mjs:96 (parseCopic)        |     4 |     0 |      1 | low      |
| D6  | parseCopic keeps duplicate marker codes instead of rejecting or deduplicating them                                                                             | apps/theme-editor/scripts/brand-colors.mjs:96 (parseCopic)        |     4 |     0 |      1 | low      |
| D7  | The upstream fetches have no timeout, so the generator can hang forever                                                                                        | apps/theme-editor/scripts/gen-brand-colors.mjs:20 (get)           |     5 |     0 |      1 | low      |
