# path-tools.part1: saturation

Repeated blind reviews of the area `path-tools.part1` (37 files, 4262 lines) at the frozen commit
`ca78c1c42a`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report path-tools.part1` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        4 |   4 |        4 |   4 |   0 |          – |      – |        – | $0.19 |    $0.05 |     0.2 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        4 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        4 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                               | where                                                                      | first | codex | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------|------:|------:|----------|
| D1  | Host keeps the caller's mutable selection Set, so later mutations change selectedAnchors without notifying subscribers               | packages/path-tools/src/host/createPathEditHost.ts:89 (setSelectedAnchors) |     1 |     1 | low      |
| D2  | useFilletControls omits getServerSnapshot from useSyncExternalStore, so server rendering throws                                      | packages/path-tools/src/fillet/useFilletControls.ts:61 (useFilletControls) |     1 |     1 | low      |
| D3  | Girth drag grips an anchor on a different subpath from the grabbed stroke edge                                                       | packages/path-tools/src/girth/widthEdit.ts:104 (gripAt)                    |     1 |     1 | medium   |
| D4  | Knead uses a circular world radius from the larger axis extent, so under anisotropic scale it moves points outside the visible brush | packages/path-tools/src/knead/knead.ts:67 (pxReach)                        |     1 |     1 | medium   |
