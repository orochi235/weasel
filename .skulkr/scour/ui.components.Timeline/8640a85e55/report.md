# ui.components.Timeline: saturation

Repeated blind reviews of the area `ui.components.Timeline` (18 files, 1951 lines) at the frozen commit
`8640a85e55`, with no fixes between them, from `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 20.0 known defects per thousand lines, at least 5. The next defect should cost about $1.60. `skulkr scour report ui.components.Timeline` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | claude |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.94 |    $0.47 |     2.9 |
|   2 | claude |        2 |   1 |        3 |   2 |   1 |        4.0 |    1.0 |    25.0% | $1.13 |    $0.69 |     4.0 |
|   3 | claude |        3 |   3 |        6 |   5 |   1 |       14.3 |    8.3 |    59.5% | $1.32 |    $0.57 |     4.6 |
|   4 | claude |        2 |   0 |        6 |   4 |   1 |       12.0 |    6.0 |    38.1% | $0.97 |    $0.73 |     3.9 |
|   5 | claude |        3 |   2 |        8 |   6 |   1 |       22.4 |   14.4 |    46.2% | $0.61 |    $0.62 |     2.2 |
|   6 | claude |        4 |   3 |       11 |   9 |   1 |       44.8 |   33.8 |    53.9% | $0.62 |    $0.51 |     2.3 |
|   7 | claude |        3 |   2 |       13 |  11 |   1 |       64.9 |   51.9 |    56.2% | $1.18 |    $0.52 |     5.1 |
|   8 | claude |        2 |   1 |       14 |  12 |   1 |       77.0 |   63.0 |    55.8% | $1.08 |    $0.56 |     3.8 |
|   9 | claude |        2 |   1 |       15 |  13 |   1 |       90.1 |   75.1 |    55.5% | $0.69 |    $0.57 |     2.5 |
|  10 | claude |        3 |   1 |       16 |  13 |   2 |       54.0 |   38.0 |    48.3% | $0.84 |    $0.59 |     3.2 |
|  11 | claude |        2 |   1 |       17 |  14 |   2 |       61.5 |   44.5 |    48.6% | $0.79 |    $0.60 |     2.9 |
|  12 | claude |        4 |   2 |       19 |  16 |   1 |      136.3 |  117.3 |    49.4% | $1.24 |    $0.60 |     4.9 |
|  13 | claude |        1 |   1 |       20 |  17 |   1 |      153.4 |  133.4 |    51.0% | $0.47 |    $0.59 |     1.7 |
|  14 | claude |        2 |   1 |       21 |  18 |   1 |      171.4 |  150.4 |    51.0% | $1.04 |    $0.62 |     3.8 |
|  15 | claude |        2 |   1 |       22 |  18 |   2 |       97.6 |   75.6 |    47.9% | $1.29 |    $0.65 |     4.7 |
|  16 | claude |        2 |   2 |       24 |  20 |   2 |      117.8 |   93.8 |    50.6% | $0.83 |    $0.63 |     3.3 |
|  17 | claude |        2 |   0 |       24 |  20 |   2 |      118.1 |   94.1 |    48.2% | $1.01 |    $0.67 |     4.0 |
|  18 | claude |        2 |   1 |       25 |  21 |   2 |      129.1 |  104.1 |    48.3% | $0.69 |    $0.67 |     2.8 |
|  19 | claude |        2 |   0 |       25 |  19 |   4 |       67.8 |   42.8 |    41.3% | $0.70 |    $0.70 |     2.6 |
|  20 | claude |        4 |   2 |       27 |  21 |   4 |       79.4 |   52.4 |    42.0% | $1.07 |    $0.69 |     4.3 |
|  21 | claude |        1 |   0 |       27 |  20 |   5 |       65.1 |   38.1 |    39.0% | $0.68 |    $0.71 |     2.7 |
|  22 | claude |        3 |   2 |       29 |  21 |   6 |       64.1 |   35.1 |    38.6% | $0.77 |    $0.69 |     3.2 |
|  23 | claude |        4 |   1 |       30 |  21 |   6 |       65.2 |   35.2 |    35.9% | $0.88 |    $0.70 |     3.1 |
|  24 | claude |        3 |   0 |       30 |  21 |   5 |       72.3 |   42.3 |    34.3% | $0.80 |    $0.72 |     2.9 |
|  25 | claude |        3 |   3 |       33 |  24 |   5 |       88.3 |   55.3 |    37.4% | $0.59 |    $0.67 |     2.5 |
|  26 | claude |        2 |   0 |       33 |  23 |   6 |       75.4 |   42.4 |    34.7% | $1.64 |    $0.72 |     6.3 |
|  27 | claude |        2 |   1 |       34 |  24 |   6 |       80.2 |   46.2 |    35.1% | $0.77 |    $0.72 |     2.7 |
|  28 | claude |        3 |   1 |       35 |  24 |   7 |       74.7 |   39.7 |    33.6% | $0.99 |    $0.73 |     3.9 |
|  29 | claude |        4 |   1 |       36 |  24 |   7 |       75.7 |   39.7 |    31.8% | $1.07 |    $0.74 |     4.0 |
|  30 | claude |        4 |   1 |       37 |  25 |   6 |       87.3 |   50.3 |    31.5% | $0.74 |    $0.74 |     2.8 |
|  31 | claude |        2 |   0 |       37 |  24 |   7 |       76.8 |   39.8 |    29.4% | $0.76 |    $0.76 |     3.2 |
|  32 | claude |        4 |   1 |       38 |  24 |   7 |       77.9 |   39.9 |    27.7% | $1.25 |    $0.78 |     6.5 |
|  33 | claude |        2 |   0 |       38 |  24 |   7 |       77.9 |   39.9 |    27.1% | $0.97 |    $0.80 |     3.9 |
|  34 | claude |        3 |   1 |       39 |  24 |   8 |       73.9 |   34.9 |    26.1% | $1.43 |    $0.82 |     5.3 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| claude      | Chao2     |        34 |       39 |       73.9 |   34.9 |    26.1% |       – |
| all sources | Chao2     |        34 |       39 |       73.9 |   34.9 |    26.1% |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                             | where                                                                                                                                                                   | first | claude | severity |
|-----|----------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------:|-------:|----------|
| D1  | An arrow step on a key past the timeline's duration jumps it back to the duration, whichever arrow is pressed                                      | packages/ui/src/components/Timeline/Lane.tsx:178 (markKeys)                                                                                                             |     1 |     25 | medium   |
| D2  | A nested timeline with an empty label gives its children folds without its prefix, colliding with top-level rows                                   | packages/ui/src/components/Timeline/lanes.ts:51 (buildLanes)                                                                                                            |     1 |      1 | low      |
| D3  | A nested timeline's fold counts same-labeled siblings of any kind, so adding or removing an unrelated track flips its open/shut state              | packages/ui/src/components/Timeline/lanes.ts:48 (buildLanes)                                                                                                            |     2 |      1 | low      |
| D4  | A graph lane's value-axis labels are clipped away by the lane track's overflow: clip                                                               | packages/ui/src/components/Timeline/Timeline.module.css:47 (.laneTrack)                                                                                                 |     3 |      1 | medium   |
| D5  | On a read-only graph lane, dragging a key past its neighbor selects the neighbor                                                                   | packages/ui/src/components/Timeline/LaneGraph.tsx:93 (onLayerChange)                                                                                                    |     3 |      3 | medium   |
| D6  | A dope-sheet drag snapped back onto its own time still commits a tiny move on a fractionally offset row                                            | packages/ui/src/components/Timeline/useKeyDrag.ts:98 (onEnd)                                                                                                            |     3 |      1 | low      |
| D7  | Pressing Delete while a segment or disclosure has focus deletes the selected key on a different row                                                | packages/ui/src/components/Timeline/Timeline.tsx:118 (onRootKeyDown)                                                                                                    |     5 |      1 | low      |
| D8  | deleteKey is documented to select the key before the deleted one, which is false when the first key is deleted                                     | packages/ui/src/components/Timeline/keys.ts:155 (deleteKey)                                                                                                             |     5 |      1 | low      |
| D9  | A dope-sheet drag echoed through onInput commits against the previewed tracks, so crossing a neighbor moves the neighbor                           | packages/ui/src/components/Timeline/Timeline.tsx:216 (bindLaneEdits, onKeyChange / onKeyInput)                                                                          |     6 |      1 | high     |
| D10 | An echoed dope-sheet drag never fires onChange                                                                                                     | packages/ui/src/components/Timeline/Timeline.tsx:219 (bindLaneEdits, onKeyChange)                                                                                       |     6 |      1 | high     |
| D11 | Canceling an echoed dope-sheet drag reverts to the last preview instead of the drag's starting position                                            | packages/ui/src/components/Timeline/Timeline.tsx:212 (bindLaneEdits, onKeyRevert)                                                                                       |     6 |      1 | high     |
| D12 | A dope-sheet key drag is not canceled when a hold starts mid-drag and still commits its edit, unlike the graph lane                                | packages/ui/src/components/Timeline/useKeyDrag.ts:70 (onKeyPointerDown), packages/ui/src/components/Timeline/Lane.tsx:73 (Lane → useKeyDrag)                            |     7 |      2 | medium   |
| D13 | A nested row's dragged key snaps to stops before the row's start, so the ghost shows a position the key will not land on                           | packages/ui/src/components/Timeline/useKeyDrag.ts:58 (at)                                                                                                               |     7 |      3 | medium   |
| D14 | A graph-mode key drag never sets the preview, so the inspector shows the neighbor key while the dragged key is past it                             | packages/ui/src/components/Timeline/Timeline.tsx:225 (bindLaneEdits, onKeysInput)                                                                                       |     8 |      9 | medium   |
| D15 | A graph lane's value range is recomputed from the keys being dragged, so dragging the top or bottom key outward makes the range chase the pointer  | packages/ui/src/components/Timeline/LaneGraph.tsx:134 (LaneGraph, valueRange(state.keys))                                                                               |     9 |      3 | medium   |
| D16 | onCancel fires for key drags whose input the consumer never received                                                                               | packages/ui/src/components/Timeline/useKeyDrag.ts:93 (onKeyPointerDown onEnd/onCancel); packages/ui/src/components/Timeline/Timeline.tsx:188 (bindLaneEdits onKeyInput) |    10 |      2 | low      |
| D17 | A read-only Timeline in graph mode selects no key or segment because its ReadOnly scope makes the curve editor refuse every press and key          | packages/ui/src/components/Timeline/LaneGraph.tsx:126 (LaneGraph)                                                                                                       |    11 |      2 | medium   |
| D18 | Deleting a row's last key by keyboard drops focus to the document body                                                                             | packages/ui/src/components/Timeline/Lane.tsx:225 (useFocusFollowsKey)                                                                                                   |    12 |      1 | low      |
| D19 | A nested timeline's run length reimplements animator's default duration instead of using it                                                        | packages/ui/src/components/Timeline/lanes.ts:96 (timelineSpan, trackEnd, declaredSpan)                                                                                  |    12 |      1 | low      |
| D20 | Committing a graph-mode key move that re-sorts the key leaves the timeline's selection on the old index, which now holds a different key           | packages/ui/src/components/Timeline/LaneGraph.tsx:118 (onLayerCommit)                                                                                                   |    13 |      2 | medium   |
| D21 | Escape pressed anywhere in the timeline, including the inspector and transport, drops the selected segment                                         | packages/ui/src/components/Timeline/Timeline.tsx:105 (onRootKeyDown)                                                                                                    |    14 |      1 | low      |
| D22 | A key selection is dropped when the consumer applies the timeline's edit after the render that the edit triggers                                   | packages/ui/src/components/Timeline/timelineState.ts:63 (useKeyAndSegment)                                                                                              |    15 |      2 | medium   |
| D23 | A dope-sheet key drag commits against the tracks captured at press, so any edit that landed during the drag is undone                              | packages/ui/src/components/Timeline/Timeline.tsx:236 (bindLaneEdits, onKeyChange), packages/ui/src/components/Timeline/useKeyDrag.ts:70 (onKeyPointerDown)              |    16 |      4 | medium   |
| D24 | Canceling a bezier-handle drag in graph mode never fires onCancel                                                                                  | packages/ui/src/components/Timeline/LaneGraph.tsx:112 (onLayerCancel)                                                                                                   |    16 |      1 | low      |
| D25 | During a dope-sheet drag whose preview the consumer echoes back, segments follow the preview while key marks stay where they were at press time    | packages/ui/src/components/Timeline/Lane.tsx:131 (Lane, SegmentMarks vs KeyMarks)                                                                                       |    18 |      3 | low      |
| D26 | A dope-sheet pointer drag that re-sorts a key leaves focus on the mark now drawing its neighbor, so Delete and the arrows act on the wrong key     | packages/ui/src/components/Timeline/useKeyDrag.ts:91 (onKeyPointerDown, onEnd)                                                                                          |    20 |      1 | medium   |
| D27 | Key and segment names format times separately from the ruler's labels, and the format is not localized                                             | packages/ui/src/components/Timeline/timeScale.ts:26 (msLabel)                                                                                                           |    20 |      2 | low      |
| D28 | A dope-sheet key drag still commits its edit when the timeline turns read-only or disabled mid-drag, unlike graph mode, which refuses              | packages/ui/src/components/Timeline/useKeyDrag.ts:93 (onKeyPointerDown, session onEnd)                                                                                  |    22 |      2 | low      |
| D29 | A plain click on a dope-sheet key shows drag feedback (dimmed key and ghost) for as long as the button is held, because drag state is set at press | packages/ui/src/components/Timeline/useKeyDrag.ts:76 (onKeyPointerDown, setDrag at press)                                                                               |    22 |      1 | low      |
| D30 | Unmounting a lane mid-drag sends the consumer's onInput the whole track list as captured at press                                                  | packages/ui/src/components/Timeline/useKeyDrag.ts:45 (unmount cleanup) → packages/ui/src/components/Timeline/Timeline.tsx:207 (bindLaneEdits onKeyRevert)               |    23 |      2 | low      |
| D31 | A graph-mode key drag snaps to its own live position when the consumer echoes onInput, so a slow drag sticks                                       | packages/ui/src/components/Timeline/LaneGraph.tsx:78 (LaneGraph, snapX memo)                                                                                            |    25 |      1 | medium   |
| D32 | The ruler swallows the page's wheel and does nothing when window is controlled without onWindowChange                                              | packages/ui/src/components/Timeline/Timeline.tsx:158 (Timeline → TimeRuler onWindowChange)                                                                              |    25 |      1 | low      |
| D33 | An event mark is announced to assistive tech as a "key"                                                                                            | packages/ui/src/components/Timeline/LaneMarks.tsx:66 (KeyMarks)                                                                                                         |    25 |      1 | low      |
| D34 | The ruler keeps its ew-resize scrub cursor while the timeline is read-only or disabled, though nothing scrubs                                      | packages/ui/src/components/Timeline/Timeline.module.css:5 (.ruler)                                                                                                      |    27 |      1 | low      |
| D35 | In graph mode the hold's tab order and focus attributes are never passed to the keys                                                               | packages/ui/src/components/Timeline/Lane.tsx:110 (Lane → LaneGraph)                                                                                                     |    28 |      1 | low      |
| D36 | Switching to graph mode during a dope-sheet key drag leaves the drag running, and its release commits a move nobody can see                        | packages/ui/src/components/Timeline/Lane.tsx:72 (Lane, useKeyDrag kept across mode)                                                                                     |    29 |      1 | low      |
| D37 | On a read-only timeline the inspector's easing picker and key editor stay enabled and silently drop every change                                   | packages/ui/src/components/Timeline/TimelineInspector.tsx:35 (TimelineInspector)                                                                                        |    30 |      1 | low      |
| D38 | A dope-sheet key drag released on a stop outside the row's range fires neither onChange nor onCancel                                               | packages/ui/src/components/Timeline/useKeyDrag.ts:62 (useKeyDrag `at`)                                                                                                  |    32 |      1 | medium   |
| D39 | The inspector fires onChange for an edit that changed nothing                                                                                      | packages/ui/src/components/Timeline/TimelineInspector.tsx:50 (TimelineInspector, commit / setEasing)                                                                    |    34 |      1 | low      |
