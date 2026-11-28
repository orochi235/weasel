# core.core.pages: saturation

Repeated blind reviews of the area `core.core.pages` (11 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report core.core.pages` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.17 |    $0.06 |     0.2 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        3 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        3 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                              | where                                                          | first | codex | severity |
|-----|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------|------:|------:|----------|
| D1  | A removed root ID passes the placement filter because s.get(id)?.parent == null accepts undefined, and placement throws later while measuring its pose              | packages/core/src/core/pages/placeOnPages.ts:99 (placeOnPages) |     1 |     1 | low      |
| D2  | Page edits pass unvalidated dimensions such as NaN width to layoutPages, putting NaN into later page positions and building layouts the migration validator rejects | packages/core/src/core/pages/pageEdits.ts:174                  |     1 |     1 | medium   |
| D3  | When two pages overlap a box by the same positive area, the tiebreak goes by span and picks the later page instead of the documented earlier one                    | packages/core/src/core/pages/pages.ts:109 (overlap score)      |     1 |     1 | low      |
