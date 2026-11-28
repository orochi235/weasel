# history: saturation

Repeated blind reviews of the area `history` (18 files, 2087 lines) at the frozen commit
`6be7338b8b`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: the next defect would cost about $1.66, over the limit of $1.49 (3× the $0.50 going rate). The next defect should cost about $1.66. `skulkr scour report history` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        1 |   1 |        1 |   1 |   0 |          – |      – |        – | $0.16 |    $0.16 |     0.1 |
|   2 | claude |        3 |   2 |        3 |   2 |   1 |        4.0 |    1.0 |    25.0% | $1.51 |    $0.56 |     7.0 |
|   3 | claude |        1 |   1 |        4 |   3 |   1 |        7.0 |    3.0 |    45.0% | $1.59 |    $0.82 |     7.2 |
|   4 | claude |        2 |   2 |        6 |   5 |   1 |       15.4 |    9.4 |    63.0% | $0.87 |    $0.69 |     4.9 |
|   5 | claude |        1 |   0 |        6 |   4 |   2 |        9.2 |    3.2 |    40.0% | $0.81 |    $0.82 |     4.0 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        1 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |        6 |       15.4 |    9.4 |    63.0% |       – |
| all sources    | Chao2     |         5 |        6 |        9.2 |    3.2 |    40.0% |       – |
| codex × claude | Chapman   |         – |        6 |        6.0 |    0.0 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                                             | where                                                                                                            | first | codex | claude | severity |
|-----|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Journal commit's touchedIds come from the forward half only, so after timed coalescing the entry omits IDs its undo ops touch and differs from the restored entry's union of both halves           | packages/history/src/recording.ts:102                                                                            |     1 |     1 |      1 | low      |
| D2  | A restored entry rebuilds the ops its two halves share as separate ops, so a failed undo replays a shared op twice                                                                                 | packages/history/src/restore.ts:155 (sharedHalf)                                                                 |     2 |     0 |      1 | low      |
| D3  | Journal cancel can undo a nested journal's edits ahead of a later outer edit when the outer journal undid and then edited again in between                                                         | packages/history/src/journal.ts:170 (createChildren touched/depth), packages/history/src/journal.ts:253 (cancel) |     2 |     0 |      2 | medium   |
| D4  | A goto that throws and walks all the way back rewrites entries' selections without bumping the version or recording a step                                                                         | packages/history/src/walk.ts:118 (walkOrReturn)                                                                  |     3 |     0 |      1 | low      |
| D5  | Cancelling a resumed journal changes state beneath the parent's top entry without sealing the parent's coalescing run, so a later edit can coalesce into an entry that no longer matches the state | packages/history/src/journal.ts:262 (createJournalInternal → cancel)                                             |     4 |     0 |      1 | low      |
| D6  | A restored snapshot accepts entry ids of zero and below, so a later entry can take id 0, which clear() reserves for the floor                                                                      | packages/history/src/snapshotShape.ts:8 (isId); packages/history/src/restore.ts:156 (rebuilt, nextEntryId)       |     4 |     0 |      1 | low      |
