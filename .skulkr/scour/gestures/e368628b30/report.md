# gestures: saturation

Repeated blind reviews of the area `gestures` (44 files, 4641 lines) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: the next defect would cost about $1.60, over the limit of $1.49 (3× the $0.50 going rate). The next defect should cost about $1.60. `skulkr scour report gestures` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.17 |    $0.08 |     0.1 |
|   2 | claude |        3 |   2 |        4 |   3 |   1 |        6.3 |    2.3 |    36.0% | $2.06 |    $0.56 |     4.3 |
|   3 | claude |        3 |   2 |        6 |   4 |   1 |       11.3 |    5.3 |    35.6% | $1.89 |    $0.68 |     4.2 |
|   4 | claude |        3 |   1 |        7 |   4 |   2 |       10.0 |    3.0 |    25.0% | $1.16 |    $0.75 |     5.2 |
|   5 | claude |        4 |   2 |        9 |   5 |   2 |       14.0 |    5.0 |    26.0% | $0.96 |    $0.69 |     3.5 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |        8 |       11.0 |    3.0 |    21.4% |       – |
| all sources    | Chao2     |         5 |        9 |       14.0 |    5.0 |    26.0% |       – |
| codex × claude | Chapman   |         – |        9 |       12.5 |    3.5 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                  | where                                                                                             | first | codex | claude | severity |
|-----|---------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | A release that is the first sample past the drag threshold still dispatches a click (or opens the context menu) from the buffered press                 | packages/gestures/src/recognizer/pointerRecognizer.ts:280                                         |     1 |     1 |      0 | medium   |
| D2  | focusedControlOwnsKey reads the retargeted target, so page shortcuts steal Space/arrow keys from focused shadow-root controls                           | packages/gestures/src/ui/keyOwner.ts:88 (focusedControlOwnsKey)                                   |     1 |     1 |      3 | medium   |
| D3  | formatShortcut drops `shift: 'optional'` only on the final key, so leader steps with optional shift render a spurious Shift                             | packages/gestures/src/ui/formatShortcut.ts:72 (formatShortcut)                                    |     2 |     0 |      3 | low      |
| D4  | routeGestureForSpecKind looks up a plain object, so inherited keys (e.g. `toString`, `constructor`) resolve as spec kinds                               | packages/gestures/src/grammar/specKinds.ts:36 (routeGestureForSpecKind)                           |     2 |     0 |      1 | low      |
| D5  | The press-ownership check reads the retargeted `e.target`, so a press on a control inside an open shadow root is not treated as the control's own press | packages/gestures/src/ui/controlTarget.ts:17 (isInControlWithin)                                  |     3 |     0 |      2 | medium   |
| D6  | matchKey does not resolve the `Esc`/`Space` aliases its legend doc says it reads, so a hand-written KeySpec naming them never matches                   | packages/gestures/src/ui/match.ts:76 (matchKey)                                                   |     3 |     0 |      2 | medium   |
| D7  | CONTROL_SELECTOR leaves out ARIA widgets that handle their own press and keys, so presses and keys on them are not treated as the control's own         | packages/gestures/src/ui/controlTarget.ts:4 (CONTROL_SELECTOR)                                    |     4 |     0 |      1 | low      |
| D8  | held('Shift') / key('Alt') sugar builds a spec that its own modifier key event can never match                                                          | packages/gestures/src/ui/keySugar.ts:45 (held); packages/gestures/src/ui/match.ts:217 (matchSpec) |     5 |     0 |      1 | low      |
| D9  | keyLegendFromCode skips key-name labels for modifier codes that keyLegendFromKey honors                                                                 | packages/gestures/src/ui/keyLegendFromCode.ts:29 (keyLegendFromCode)                              |     5 |     0 |      1 | low      |
