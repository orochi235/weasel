# rig: saturation

Repeated blind reviews of the area `rig` (16 files, 954 lines) at the frozen commit
`0269be874a`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report rig` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.18 |    $0.06 |     0.2 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        3 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        3 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                | where                                              | first | codex | severity |
|-----|-------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------|------:|------:|----------|
| D1  | Active joint is stored by name only, so switching rigs silently selects another rig's joint with the same name                                        | packages/rig/src/bone/rigEditState.ts:27           |     1 |     1 | medium   |
| D2  | Weight stroke re-resolves the rig per dab with the joint name captured at press, so a mid-gesture rig change commits edits to two rigs                | packages/rig/src/weight/weightActions.ts:143       |     1 |     1 | medium   |
| D3  | sceneReach uses the larger world extent as a circular radius, so under nonuniform zoom, joint picking and the brush overreach what is drawn on screen | packages/rig/src/bone/placedRig.ts:28 (sceneReach) |     1 |     1 | medium   |
