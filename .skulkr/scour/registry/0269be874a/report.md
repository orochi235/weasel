# registry: saturation

Repeated blind reviews of the area `registry` (25 files, 1390 lines) at the frozen commit
`0269be874a`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 5.0 known defects per thousand lines, at least 5. The next defect should cost about $0.68. `skulkr scour report registry` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        1 |   1 |        1 |   1 |   0 |          – |      – |        – | $0.17 |    $0.17 |     0.1 |
|   2 | claude |        1 |   1 |        2 |   2 |   0 |        2.5 |    0.5 |   100.0% | $0.95 |    $0.56 |     1.8 |
|   3 | claude |        3 |   3 |        5 |   5 |   0 |       11.7 |    6.7 |   100.0% | $0.84 |    $0.39 |     3.2 |
|   4 | claude |        1 |   0 |        5 |   4 |   1 |       11.0 |    6.0 |    57.1% | $0.70 |    $0.53 |     2.6 |
|   5 | claude |        2 |   2 |        7 |   6 |   1 |       21.4 |   14.4 |    69.2% | $0.85 |    $0.50 |     3.6 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        1 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |        6 |       15.4 |    9.4 |    63.0% |       – |
| all sources    | Chao2     |         5 |        7 |       21.4 |   14.4 |    69.2% |       – |
| codex × claude | Chapman   |         – |        7 |       13.0 |    6.0 |        – |       0 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                           | where                                                                                           | first | codex | claude | severity |
|-----|------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Child release called from a handback notification no-ops and marks itself done, then relean restores a hold that can later retake ownership with no release left | packages/registry/src/extensionRegistry.ts:116                                                  |     1 |     1 |      0 | medium   |
| D2  | deepEqual treats a null-prototype array as a plain object, so it compares equal to an object with matching index keys                                            | packages/registry/src/deepEqual.ts:33 (step)                                                    |     2 |     0 |      1 | low      |
| D3  | A child registry's entries() keeps a stale order when a release and re-register in the same tick turn its own copy into a lean                                   | packages/registry/src/extensionRegistry.ts:255 (register, lean branch) and :213 (entries cache) |     3 |     0 |      2 | low      |
| D4  | The README's usage example triggers the clash warning that the library treats as a mistake                                                                       | packages/registry/README.md:20 (Usage)                                                          |     3 |     0 |      1 | low      |
| D5  | The README says `shadowed` is ordered oldest first, but it is ordered by rank first                                                                              | packages/registry/README.md:44 (Exports)                                                        |     3 |     0 |      1 | low      |
| D6  | deepEqual reads an array hole through the prototype chain, so a hole can compare equal to an inherited value                                                     | packages/registry/src/deepEqual.ts:36 (step)                                                    |     5 |     0 |      1 | low      |
| D7  | createPart makes two parts for one owner when make reads the part re-entrantly                                                                                   | packages/registry/src/part.ts:15 (createPart)                                                   |     5 |     0 |      1 | low      |
