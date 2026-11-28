# routing: saturation

Repeated blind reviews of the area `routing` (35 files, 3449 lines) at the frozen commit
`0269be874a`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report routing` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.18 |    $0.06 |     0.2 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        3 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        3 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                           | where                                                                     | first | codex | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------|------:|------:|----------|
| D1  | A string item suppresses the fallback FileList, so files exposed only through dataTransfer.files are lost on ingestion                           | packages/routing/src/ingestion/ingestItems.ts:100 (materializer)          |     1 |     1 | medium   |
| D2  | itemTypesFromDataTransfer skips the files fallback when string items exist, hiding a pending file type and blocking a matching file-drop preview | packages/routing/src/ingestion/ingestItems.ts (itemTypesFromDataTransfer) |     1 |     1 | medium   |
| D3  | The paint color setter spreads the paint captured when the menu resolved, writing back stale opacity and other paint fields                      | packages/routing/src/menus/compoundRows.ts:207 (paint color row setter)   |     1 |     1 | low      |
