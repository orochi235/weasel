# prefs-editor.PrefSchemaEditor.part2: saturation

Repeated blind reviews of the area `prefs-editor.PrefSchemaEditor.part2` (36 files, 2180 lines) at the frozen commit
`ca78c1c42a`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report prefs-editor.PrefSchemaEditor.part2` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.17 |    $0.09 |     0.2 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        2 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        2 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                              | where                                                         | first | codex | severity |
|-----|-------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------|------:|------:|----------|
| D1  | A host acknowledgment arriving before send records the pending async submission is never reconciled into the draft and undo history | packages/prefs-editor/src/PrefSchemaEditor/useDocument.ts:102 |     1 |     1 | p2       |
| D2  | useSyncExternalStore history subscription lacks getServerSnapshot, so server-rendering AssetEditor throws                           | packages/prefs-editor/src/PrefSchemaEditor/useDocument.ts:64  |     1 |     1 | p3       |
