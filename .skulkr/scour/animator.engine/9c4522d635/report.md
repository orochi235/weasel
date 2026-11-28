# animator.engine: saturation

Repeated blind reviews of the area `animator.engine` (34 files, 4511 lines) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.98, or 40 occasions have run.
Not stopped yet. The next defect should cost about $1.63. `skulkr scour report animator.engine` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.17 |    $0.09 |     0.2 |
|   2 | claude |        3 |   3 |        5 |   5 |   0 |       10.0 |    5.0 |   100.0% | $1.90 |    $0.41 |     5.3 |
|   3 | claude |        3 |   3 |        8 |   8 |   0 |       26.7 |   18.7 |   100.0% | $1.09 |    $0.40 |     4.5 |
|   4 | claude |        1 |   1 |        9 |   9 |   0 |       36.0 |   27.0 |   100.0% | $1.02 |    $0.47 |     4.3 |
|   5 | claude |        3 |   1 |       10 |   8 |   2 |       22.8 |   12.8 |    59.3% | $0.92 |    $0.51 |     4.3 |
|   6 | claude |        4 |   1 |       11 |   7 |   3 |       17.8 |    6.8 |    37.3% | $1.25 |    $0.58 |     5.4 |
|   7 | claude |        5 |   3 |       14 |  10 |   2 |       35.4 |   21.4 |    44.6% | $1.89 |    $0.59 |     5.2 |
|   8 | claude |        3 |   2 |       16 |  11 |   3 |       33.6 |   17.6 |    42.5% | $1.12 |    $0.59 |     5.3 |
|   9 | claude |        2 |   1 |       17 |  11 |   3 |       34.9 |   17.9 |    38.1% | $1.59 |    $0.64 |     6.6 |
|  10 | claude |        5 |   2 |       19 |  11 |   5 |       29.9 |   10.9 |    31.2% | $1.75 |    $0.67 |     4.3 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |         9 |       18 |       31.4 |   13.4 |    33.6% |       – |
| all sources    | Chao2     |        10 |       19 |       29.9 |   10.9 |    31.2% |       – |
| codex × claude | Chapman   |         – |       19 |       27.5 |    8.5 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                  | where                                                                                                                           | first | codex | claude | severity |
|-----|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Passing a foreign animator's handle to cancel cancels an unrelated animation with the same numeric ID in this animator's table                                          | packages/animator/src/engine/animatorApi.ts:142 (cancel)                                                                        |     1 |     1 |      0 | medium   |
| D2  | A throwing onCancel callback during cancelAll propagates before the host's cancelFrame is called, leaving a requested frame outstanding                                 | packages/animator/src/engine/animatorApi.ts:144 (cancelAll)                                                                     |     1 |     1 |      1 | low      |
| D3  | An animation paused at its end while playing backward is treated as playing forward and finishes at `to`                                                                | packages/animator/src/engine/tweenAnimation.ts:69 (startTween tick); also offsetTween.ts:106, handoff/run.ts:139                |     2 |     0 |      1 | medium   |
| D4  | A handed-off run released while paused and playing backward continues forward                                                                                           | packages/animator/src/engine/handoff/run.ts:107 (release)                                                                       |     2 |     0 |      4 | medium   |
| D5  | A throw from onDone in a taken-back run's continuation leaves the original run's row on the table forever                                                               | packages/animator/src/engine/handoff/run.ts:113 (release, done callback)                                                        |     2 |     0 |      1 | low      |
| D6  | A taken-back compositor run's row stays on the table forever when its main-thread continuation leaves without finishing                                                 | packages/animator/src/engine/handoff/run.ts:107 (launch → release)                                                              |     3 |     0 |      2 | medium   |
| D7  | follow measures a frame against a clock seeded from host.now(), which a hosted animator's outside clock may not share                                                   | packages/animator/src/engine/core.ts:151 (createAnimatorCore → follow; seedClock at :62)                                        |     3 |     0 |      1 | medium   |
| D8  | A target whose show throws while only a timeline hold moves it logs an error every frame and is never stopped                                                           | packages/animator/src/engine/core.ts:89 (targets stop), packages/animator/src/engine/offsets.ts:203 (createTargetBook stop)     |     3 |     0 |      2 | medium   |
| D9  | A throw from a just-rested target's publish is swallowed with no log and the target is not stopped                                                                      | packages/animator/src/engine/offsets.ts:233 (createTargetBook publish, via show/showNow)                                        |     4 |     0 |      4 | low      |
| D10 | A compositor run never claims its target, so another animator can take the target back before it is refused                                                             | packages/animator/src/engine/offsets.ts:262 (createTargetBook → check)                                                          |     5 |     0 |      3 | medium   |
| D11 | axesFor accepts ±Infinity, which turns a target's offsets into NaN                                                                                                      | packages/animator/src/engine/offsets.ts:8 (axesFor)                                                                             |     6 |     0 |      1 | low      |
| D12 | A setter that throws in holdRows' leave stops the loop early, so the rows after it stay held forever                                                                    | packages/animator/src/engine/holdRows.ts:51 (startHoldRows → leave)                                                             |     7 |     0 |      2 | medium   |
| D13 | A release that throws leaves the hold registered on the animator's table                                                                                                | packages/animator/src/engine/holdAnimation.ts:45, packages/animator/src/engine/holdRows.ts:86 (release)                         |     7 |     0 |      2 | low      |
| D14 | Reading the clock between frames adds elapsed time that the next tick adds again, so up to one frame is counted twice                                                   | packages/animator/src/engine/core.ts:206 (createPacing → current), packages/animator/src/engine/frame.ts (tick)                 |     7 |     0 |      1 | low      |
| D15 | cancelAll cancels the host frame after the onCancel reports run, so a frame requested by an animation one of those reports starts is canceled and that animation stalls | packages/animator/src/engine/animatorApi.ts:150 (createAnimatorApi, cancelAll)                                                  |     8 |     0 |      1 | medium   |
| D16 | A coast started with an explicit `from` on a target with holds is shifted by the pending offset beside those holds, so it starts from the wrong place                   | packages/animator/src/engine/offsetPhysics.ts:95 (startOffsetPhysics, committed/start)                                          |     8 |     0 |      1 | low      |
| D17 | A timeline track's hold is not released when the target is stopped with target.stop() or when its table row is removed, so the hold keeps moving the target             | packages/animator/src/engine/animatorApi.ts:84 (startTimeline hold), packages/animator/src/engine/holds.ts:150 (openHold)       |     9 |     0 |      1 | medium   |
| D18 | A handed-off run whose target setter throws on end or cancel never cancels its browser animation                                                                        | packages/animator/src/engine/handoff/run.ts:110 (launch → end), packages/animator/src/engine/handoff/run.ts:156 (seed.onCancel) |    10 |     0 |      1 | medium   |
| D19 | A closed-form spring played back to its start emits its voice's reading instead of `from`                                                                               | packages/animator/src/engine/physicsAnimation.ts:101 (startPhysics tick)                                                        |    10 |     0 |      1 | low      |
