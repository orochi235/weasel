# routing.interactions: saturation

Repeated blind reviews of the area `routing.interactions` (14 files, 1164 lines) at the frozen commit
`758e1efac7`, with no fixes between them, from `claude`, `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 25.8 known defects per thousand lines, at least 5. The next defect should cost about $1.23. `skulkr scour report routing.interactions` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | claude |        4 |   4 |        4 |   4 |   0 |          – |      – |        – | $0.72 |    $0.18 |     2.6 |
|   2 | claude |        3 |   2 |        6 |   5 |   1 |       12.3 |    6.3 |    51.0% | $0.63 |    $0.23 |     2.1 |
|   3 | claude |        3 |   3 |        9 |   8 |   1 |       30.3 |   21.3 |    71.1% | $0.89 |    $0.25 |     2.7 |
|   4 | claude |        3 |   2 |       11 |  10 |   0 |       44.8 |   33.8 |    76.9% | $0.78 |    $0.28 |     3.4 |
|   5 | claude |        5 |   4 |       15 |  13 |   1 |       82.6 |   67.6 |    65.9% | $0.64 |    $0.24 |     2.5 |
|   6 | claude |        3 |   1 |       16 |  12 |   3 |       36.0 |   20.0 |    49.6% | $0.60 |    $0.27 |     2.5 |
|   7 | claude |        1 |   0 |       16 |  12 |   2 |       46.9 |   30.9 |    49.4% | $0.68 |    $0.31 |     2.7 |
|   8 | claude |        4 |   3 |       19 |  15 |   2 |       68.2 |   49.2 |    53.5% | $0.78 |    $0.30 |     3.1 |
|   9 | claude |        3 |   2 |       21 |  16 |   3 |       58.9 |   37.9 |    50.9% | $0.86 |    $0.31 |     3.9 |
|  10 | claude |        2 |   1 |       22 |  17 |   3 |       65.3 |   43.4 |    51.1% | $0.90 |    $0.34 |     4.2 |
|  11 | claude |        3 |   0 |       22 |  16 |   4 |       51.1 |   29.1 |    43.5% | $0.56 |    $0.37 |     2.4 |
|  12 | claude |        1 |   0 |       22 |  16 |   4 |       51.3 |   29.3 |    42.5% | $0.50 |    $0.39 |     2.1 |
|  13 | claude |        3 |   0 |       22 |  15 |   4 |       48.0 |   26.0 |    36.8% | $0.60 |    $0.42 |     2.5 |
|  14 | claude |        3 |   0 |       22 |  13 |   6 |       35.1 |   13.1 |    28.9% | $0.42 |    $0.43 |     1.5 |
|  15 | claude |        4 |   1 |       23 |  13 |   6 |       36.1 |   13.1 |    26.5% | $0.82 |    $0.45 |     3.6 |
|  16 | claude |        3 |   0 |       23 |  12 |   7 |       32.6 |    9.6 |    22.7% | $0.72 |    $0.48 |     2.8 |
|  17 | claude |        2 |   0 |       23 |  12 |   7 |       32.7 |    9.7 |    21.9% | $0.53 |    $0.51 |     2.1 |
|  18 | claude |        3 |   0 |       23 |  12 |   7 |       32.7 |    9.7 |    20.8% | $0.42 |    $0.52 |     1.4 |
|  19 | claude |        1 |   0 |       23 |  12 |   7 |       32.7 |    9.7 |    20.5% | $0.49 |    $0.55 |     1.8 |
|  20 | claude |        2 |   0 |       23 |  12 |   7 |       32.8 |    9.8 |    19.8% | $0.72 |    $0.58 |     3.0 |
|  21 | claude |        2 |   0 |       23 |  11 |   7 |       31.2 |    8.2 |    17.5% | $0.51 |    $0.60 |     2.0 |
|  22 | claude |        4 |   1 |       24 |  12 |   5 |       37.7 |   13.7 |    18.3% | $0.75 |    $0.61 |     3.0 |
|  23 | claude |        3 |   1 |       25 |  12 |   6 |       36.5 |   11.5 |    17.4% | $0.48 |    $0.60 |     1.9 |
|  24 | claude |        3 |   0 |       25 |  11 |   6 |       34.7 |    9.7 |    15.2% | $0.64 |    $0.63 |     2.4 |
|  25 | claude |        4 |   0 |       25 |  10 |   6 |       33.0 |    8.0 |    13.0% | $0.80 |    $0.66 |     3.3 |
|  26 | codex  |        8 |   5 |       30 |  14 |   7 |       43.5 |   13.5 |    16.6% | $0.29 |    $0.56 |     0.4 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| claude         | Chao2     |        25 |       25 |       33.0 |    8.0 |    13.0% |       – |
| codex          | Chao2     |         1 |        8 |          – |      – |        – |       – |
| all sources    | Chao2     |        26 |       30 |       43.5 |   13.5 |    16.6% |       – |
| claude × codex | Chapman   |         – |       30 |       57.5 |   27.5 |        – |       3 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                                  | where                                                                                                              | first | claude | codex | severity |
|-----|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|------:|-------:|------:|----------|
| D1  | A press that only scrolls under a still pointer reports `moved: false` though its point moved                                                                                           | packages/routing/src/interactions/handleDrag/handleDrag.ts:186 (useHandleDrag, `away`)                             |     1 |      2 |     0 | low      |
| D2  | `overflow: clip` is taken for a sticky box's scrollport                                                                                                                                 | packages/routing/src/interactions/handleDrag/handleDrag.ts:93 (scrollersOf)                                        |     1 |     12 |     0 | low      |
| D3  | A missed release past the threshold but before activation is reported as a click under `missedRelease: 'click'`                                                                         | packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts:91 (startThresholdDrag, `missedRelease`)          |     1 |      1 |     0 | low      |
| D4  | `undoKeyStep` hands the page the undo of a text field inside a closed shadow root                                                                                                       | packages/routing/src/interactions/keyHelpers.ts:75 (undoKeyStep)                                                   |     1 |      1 |     0 | low      |
| D5  | onEnd is documented to fire before teardown completes but fires after it                                                                                                                | packages/routing/src/interactions/pointerSession/pointerSession.ts:62 (PointerSessionCallbacks.onEnd), :152 (end)  |     2 |      4 |     0 | low      |
| D6  | Carry surfaces in other documents (iframes) are hit-tested with the top document's client point                                                                                         | packages/routing/src/interactions/carry/carry.ts:82 (surfaceAt)                                                    |     2 |      1 |     0 | low      |
| D7  | browserReservedChord misses Cmd+Shift+[ / ] when the spec is bound by `code`                                                                                                            | packages/routing/src/interactions/browserReservedKeys.ts:84 (keysOf)                                               |     3 |      2 |     0 | low      |
| D8  | A sticky rect element feeds its own drag back into its coordinate space                                                                                                                 | packages/routing/src/interactions/handleDrag/handleDrag.ts:112 (stickyScrollerOf), :87 (scrollersOf)               |     3 |      3 |     0 | low      |
| D9  | A sweep surface whose items sit in its own shadow root never reaches an item                                                                                                            | packages/routing/src/interactions/sweep/sweep.ts:82 (itemAt)                                                       |     3 |      7 |     0 | low      |
| D10 | A sticky ancestor stuck to the page viewport has its scroll read off the root element's rect, which itself scrolls, so handle coordinates go wrong while it is stuck and while it rides | packages/routing/src/interactions/handleDrag/handleDrag.ts:120 (stickyScrollerOf), :97 (scrollersOf, `p === root`) |     4 |     12 |     1 | medium   |
| D11 | A carry's onMove still reaches the source after the carry was canceled from inside that same move                                                                                       | packages/routing/src/interactions/carry/carry.ts:133 (startCarry, onMove)                                          |     4 |      1 |     1 | medium   |
| D12 | A sweep never reaches the items between its last move and the release point                                                                                                             | packages/routing/src/interactions/sweep/sweep.ts:146 (createSweepAction → start → onEnd)                           |     5 |      3 |     1 | medium   |
| D13 | containsComposed ignores slot assignment, so a slotted item's drag doesn't preempt a surface inside a shadow root                                                                       | packages/routing/src/interactions/elementAt.ts:21 (containsComposed)                                               |     5 |      2 |     0 | low      |
| D14 | Sweep can't find items slotted into the surface                                                                                                                                         | packages/routing/src/interactions/sweep/sweep.ts:91 (itemAt)                                                       |     5 |      3 |     0 | low      |
| D15 | handleDrag's containing-block test misses `transform-style: preserve-3d`                                                                                                                | packages/routing/src/interactions/handleDrag/handleDrag.ts:58 (holdsFixed)                                         |     5 |      2 |     0 | low      |
| D16 | browserReservedChord returns null for every chord that needs the Windows/Super key, though the desktop takes all of them                                                                | packages/routing/src/interactions/browserReservedKeys.ts:96 (browserReservedChord)                                 |     6 |      1 |     0 | low      |
| D17 | useHandleDrag ignores page scroll in quirks mode, where the body rather than the root element scrolls the page                                                                          | packages/routing/src/interactions/handleDrag/handleDrag.ts:88 (scrollersOf / scrollerOf)                           |     8 |      1 |     0 | low      |
| D18 | BROWSER_RESERVED_CHORDS leaves out OS-level chords a page can never receive, so browserReservedChord does not flag them                                                                 | packages/routing/src/interactions/browserReservedKeys.ts:33 (BROWSER_RESERVED_CHORDS)                              |     8 |      3 |     0 | low      |
| D19 | A sweep hit-tests the press point without the finite-number guard its moves have, so a non-finite press point reaches itemAt                                                            | packages/routing/src/interactions/sweep/sweep.ts:121 (createSweepAction → pressed / itemAt)                        |     8 |      1 |     0 | low      |
| D20 | A carry surface inside a shadow root is not found when the pointer is over content slotted into it                                                                                      | packages/routing/src/interactions/carry/carry.ts:89 (surfaceAt)                                                    |     9 |      4 |     0 | low      |
| D21 | A sweep misses an item whose element is reused under a new key                                                                                                                          | packages/routing/src/interactions/sweep/sweep.ts:132 (createSweepAction → reach)                                   |     9 |      2 |     0 | low      |
| D22 | holdsFixed treats `will-change: contents` as making a box the containing block for fixed descendants, though it does not                                                                | packages/routing/src/interactions/handleDrag/handleDrag.ts:61 (holdsFixed)                                         |    10 |      2 |     0 | low      |
| D23 | holdsFixed treats a root element with `filter` or `backdrop-filter` as the containing block for fixed descendants, so a fixed-position rect has the page's scroll subtracted from it    | packages/routing/src/interactions/handleDrag/handleDrag.ts:58 (holdsFixed / scrollersOf)                           |    15 |      1 |     0 | low      |
| D24 | swallowNextClick can miss the click a touch release raises, so that click gets through                                                                                                  | packages/routing/src/interactions/pointerSession/swallowClick.ts:26 (swallowNextClick)                             |    22 |      1 |     0 | low      |
| D25 | Sweeping off an item onto a gap and back onto the same item does not enter it again, contrary to its doc                                                                                | packages/routing/src/interactions/sweep/sweep.ts:122 (reach)                                                       |    23 |      1 |     0 | low      |
| D26 | Threshold drag delivers the threshold-crossing move after onStart cancels the handle                                                                                                    | packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts:77 (startThresholdDrag)                           |    26 |      0 |     1 | medium   |
| D27 | Carry's rectangle prefilter rejects a surface when the hit is a contained descendant overflowing the surface box                                                                        | packages/routing/src/interactions/carry/carry.ts:84 (surfaceAt)                                                    |    26 |      0 |     1 | medium   |
| D28 | Ambient-realm instanceof checks make iframe handles lose the SVG default rect and scroller scale correction                                                                             | packages/routing/src/interactions/handleDrag/handleDrag.ts:106 (scrollerOf), :141 (defaultRectEl)                  |    26 |      0 |     1 | medium   |
| D29 | swallowClick's guard lets later capture listeners on its own target still receive the click                                                                                             | packages/routing/src/interactions/pointerSession/swallowClick.ts:14 (swallowClick)                                 |    26 |      0 |     1 | low      |
| D30 | Sweep's sample interpolation can step over an item the segment briefly crosses                                                                                                          | packages/routing/src/interactions/sweep/sweep.ts:138 (createSweepAction, travel)                                   |    26 |      0 |     1 | low      |
