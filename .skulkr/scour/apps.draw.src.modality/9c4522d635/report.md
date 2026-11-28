# apps.draw.src.modality: saturation

Repeated blind reviews of the area `apps.draw.src.modality` (13 files, 577 lines) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 15.6 known defects per thousand lines, at least 5. The next defect should cost about $0.72. `skulkr scour report apps.draw.src.modality` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.16 |    $0.08 |     0.1 |
|   2 | claude |        3 |   2 |        4 |   3 |   1 |        6.3 |    2.3 |    36.0% | $1.33 |    $0.37 |     2.2 |
|   3 | claude |        3 |   2 |        6 |   5 |   0 |       12.7 |    6.7 |    62.5% | $0.58 |    $0.35 |     1.1 |
|   4 | claude |        4 |   3 |        9 |   7 |   1 |       27.4 |   18.4 |    53.3% | $0.71 |    $0.31 |     1.6 |
|   5 | claude |        1 |   0 |        9 |   6 |   2 |       16.2 |    7.2 |    39.6% | $0.67 |    $0.38 |     1.4 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |        8 |       11.1 |    3.1 |    32.5% |       – |
| all sources    | Chao2     |         5 |        9 |       16.2 |    7.2 |    39.6% |       – |
| codex × claude | Chapman   |         – |        9 |       12.5 |    3.5 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                            | where                                                                                                                              | first | codex | claude | severity |
|-----|-----------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Initial non-normal mode starts without an active session or journal, so exit/commit/cancel are no-ops                             | apps/draw/src/modality/machine.ts:44                                                                                               |     1 |     1 |      0 | medium   |
| D2  | Soft-mode entry doesn't seal the coalescing group, so a mode write merged into a pre-mode entry survives discard                  | apps/draw/src/modality/machine.ts:60                                                                                               |     1 |     1 |      2 | medium   |
| D3  | Double-clicking a path with anchors does nothing from a soft mode other than normal, while a path without anchors switches modes  | apps/draw/src/modality/useCanvasModes.ts:58 (useCanvasModes, canEnter)                                                             |     2 |     0 |      1 | medium   |
| D4  | Double-click opens path edit on a locked path that Enter refuses                                                                  | apps/draw/src/modality/useCanvasModes.ts:58 (useCanvasModes, canEnter)                                                             |     2 |     0 |      2 | medium   |
| D5  | Discard can be redone under one soft-mode setting but not under the other                                                         | apps/draw/src/modality/machine.ts:112 (discardMode)                                                                                |     3 |     0 |      2 | low      |
| D6  | The breadcrumb shows a blank name for a target or group whose label is the empty string                                           | apps/draw/src/modality/useCanvasModes.ts:77 (useModeTargetLabel); apps/draw/src/modality/enteredGroup.ts:43 (useEnteredGroupLabel) |     3 |     0 |      1 | low      |
| D7  | A double-click on a path is swallowed and does nothing while a strict mode is open                                                | apps/draw/src/modality/useCanvasModes.ts:55 (useCanvasModes, triggers)                                                             |     4 |     0 |      1 | low      |
| D8  | The breadcrumb hard-codes its key caps instead of reading them from the mode's shortcuts, so they go stale when a binding changes | apps/draw/src/modality/chrome/ModeBreadcrumb.tsx:46 (ModeBreadcrumb)                                                               |     4 |     0 |      1 | low      |
| D9  | Discarding a soft mode that has no journal leaves pre-mode entries that were undone during the mode still undone                  | apps/draw/src/modality/machine.ts:82 (undoSinceEntry)                                                                              |     4 |     0 |      1 | low      |
