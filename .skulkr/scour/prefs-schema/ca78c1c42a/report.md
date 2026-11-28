# prefs-schema: saturation

Repeated blind reviews of the area `prefs-schema` (31 files, 3544 lines) at the frozen commit
`ca78c1c42a`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: the next defect would cost about $1.83, over the limit of $1.49 (3× the $0.50 going rate). The next defect should cost about $1.83. `skulkr scour report prefs-schema` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.17 |    $0.09 |     0.2 |
|   2 | claude |        3 |   3 |        5 |   5 |   0 |       10.0 |    5.0 |   100.0% | $1.23 |    $0.28 |     3.2 |
|   3 | claude |        3 |   0 |        5 |   2 |   3 |        5.4 |    0.4 |    10.0% | $1.23 |    $0.53 |     6.1 |
|   4 | claude |        2 |   1 |        6 |   3 |   2 |        7.7 |    1.7 |    20.8% | $0.82 |    $0.58 |     3.2 |
|   5 | claude |        3 |   1 |        7 |   4 |   1 |       13.4 |    6.4 |    27.4% | $0.84 |    $0.61 |     3.9 |
|   6 | claude |        4 |   1 |        8 |   4 |   1 |       14.7 |    6.7 |    21.4% | $1.03 |    $0.67 |     4.9 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |         5 |        6 |        7.6 |    1.6 |    10.7% |       – |
| all sources    | Chao2     |         6 |        8 |       14.7 |    6.7 |    21.4% |       – |
| codex × claude | Chapman   |         – |        8 |       20.0 |   12.0 |        – |       0 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                     | where                                                                                                     | first | codex | claude | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Unit places above 100 make toDisplay call toFixed with an out-of-range argument and throw RangeError                                       | packages/prefs-schema/src/unit.ts:110 (toDisplay)                                                         |     1 |     1 |      0 | medium   |
| D2  | A custom suffix colliding with a system unit's suffix is remapped to that unit's factor, so a round trip reads back at the wrong magnitude | packages/prefs-schema/src/unit.ts:148                                                                     |     1 |     1 |      0 | low      |
| D3  | An owner's switch inside a section is never spared, so the owner can never be turned back on                                               | packages/prefs-schema/src/status.ts:136 (leafWalk members → section)                                      |     2 |     0 |      3 | medium   |
| D4  | prefAliasedLeaf draws the target's disabledReason and hidden in place of the alias's own                                                   | packages/prefs-schema/src/alias.ts:51 (prefAliasedLeaf)                                                   |     2 |     0 |      3 | low      |
| D5  | A root-path condition into a list or map entry compares the stored form, not the shown one                                                 | packages/prefs-schema/src/holding.ts:68 (insideLeaf)                                                      |     2 |     0 |      5 | low      |
| D6  | repairPrefValue throws on a list or map leaf with no item, which status.ts says an app's leaf may have                                     | packages/prefs-schema/src/repair.ts:118 (repairMap), packages/prefs-schema/src/repair.ts:133 (repairList) |     4 |     0 |      2 | medium   |
| D7  | A condition treats any scope-shaped value as a split value, even on a leaf with no scopes                                                  | packages/prefs-schema/src/judge.ts:150 (shownValue)                                                       |     5 |     0 |      1 | low      |
| D8  | A condition reads a cleared clearable number as its default, while the form shows it empty                                                 | packages/prefs-schema/src/judge.ts:164 (unsetValue)                                                       |     6 |     0 |      1 | medium   |
