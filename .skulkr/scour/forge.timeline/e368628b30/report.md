# forge.timeline: saturation

Repeated blind reviews of the area `forge.timeline` (12 files, 544 lines) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 18.4 known defects per thousand lines, at least 5. The next defect should cost about $0.84. `skulkr scour report forge.timeline` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.16 |    $0.08 |     0.1 |
|   2 | claude |        2 |   2 |        4 |   4 |   0 |        7.0 |    3.0 |   100.0% | $1.10 |    $0.32 |     2.4 |
|   3 | claude |        2 |   1 |        5 |   4 |   1 |       10.3 |    5.3 |    53.3% | $0.92 |    $0.44 |     1.6 |
|   4 | claude |        3 |   2 |        7 |   5 |   2 |       11.7 |    4.7 |    43.9% | $1.47 |    $0.52 |     3.1 |
|   5 | claude |        4 |   3 |       10 |   7 |   3 |       16.5 |    6.5 |    44.3% | $0.88 |    $0.45 |     1.5 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |        9 |       18.2 |    9.2 |    53.5% |       – |
| all sources    | Chao2     |         5 |       10 |       16.5 |    6.5 |    44.3% |       – |
| codex × claude | Chapman   |         – |       10 |       14.0 |    4.0 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                             | where                                                                   | first | codex | claude | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Returning to a timed story through an untimed route can skip fromUrl because appliedRef holds the last clocked route, so the requested t is overwritten or removed | packages/forge/src/timeline/RoutePlayhead.tsx:48                        |     1 |     1 |      1 | medium   |
| D2  | Outgoing clock's subscription writes its playhead into the incoming route's hash without checking route ownership                                                  | packages/forge/src/timeline/RoutePlayhead.tsx:46                        |     1 |     1 |      0 | low      |
| D3  | clockSpecOf passes a non-boolean loop through unchecked, so a CSF timeline with a bad loop value builds a clock with a NaN span                                    | packages/forge/src/timeline/clockSpec.ts:17 (clockSpecOf)               |     2 |     0 |      1 | low      |
| D4  | Test harness reads the playhead URL param by the literal 't' instead of PLAYHEAD_PARAM, so it misses a renamed param                                               | packages/forge/src/timeline/workshopHarness.tsx:99 (tParam)             |     2 |     0 |      2 | low      |
| D5  | OwnClock's registry keeps the first clock handle, so a clock created later never ticks                                                                             | packages/forge/src/timeline/StoryClock.tsx:40 (OwnClock)                |     3 |     0 |      1 | low      |
| D6  | A story's seek and the transport's seek move the playhead to shown time t in two different ways, and the story's version drops the run back to its first pass      | packages/forge/src/timeline/shown.ts:9 (seekShown)                      |     4 |     0 |      2 | low      |
| D7  | A URL t equal to a playing clock's shown time is dropped instead of pausing the clock there                                                                        | packages/forge/src/timeline/RoutePlayhead.tsx:32 (PlayheadSync fromUrl) |     4 |     0 |      1 | low      |
| D8  | useTimeline().loop reports true for a finite pass count, and setLoop can only write a boolean                                                                      | packages/forge/src/timeline/context.ts:93 (useTimeline)                 |     5 |     0 |      1 | low      |
| D9  | A story's seek and setLoop skip the transport's touch, while play, pause and setRate mark the clock as touched                                                     | packages/forge/src/timeline/context.ts:103-104 (useTimeline actions)    |     5 |     0 |      1 | low      |
| D10 | A redeclared span is applied a second time to a newly made clock when the spec comes back after being null                                                         | packages/forge/src/timeline/StoryClock.tsx:29-34 (useOwnClock)          |     5 |     0 |      1 | low      |
