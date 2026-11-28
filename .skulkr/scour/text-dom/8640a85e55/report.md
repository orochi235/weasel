# text-dom: saturation

Repeated blind reviews of the area `text-dom` (36 files, 3872 lines) at the frozen commit
`8640a85e55`, with no fixes between them, from `claude`, `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 7.5 known defects per thousand lines, at least 5. The next defect should cost about $1.20. `skulkr scour report text-dom` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | claude |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $2.11 |    $1.05 |     9.3 |
|   2 | claude |        2 |   2 |        4 |   3 |   1 |        6.3 |    2.3 |    36.0% | $1.48 |    $0.90 |     8.0 |
|   3 | claude |        2 |   2 |        6 |   5 |   1 |       14.3 |    8.3 |    59.5% | $1.12 |    $0.78 |     5.5 |
|   4 | claude |        3 |   3 |        9 |   8 |   1 |       33.0 |   24.0 |    73.8% | $1.59 |    $0.70 |     8.2 |
|   5 | claude |        4 |   3 |       12 |  10 |   2 |       32.0 |   20.0 |    64.9% | $1.76 |    $0.67 |     7.9 |
|   6 | claude |        3 |   2 |       14 |  11 |   2 |       39.2 |   25.2 |    57.0% | $0.81 |    $0.63 |     3.7 |
|   7 | claude |        2 |   2 |       16 |  13 |   2 |       52.2 |   36.2 |    61.8% | $1.12 |    $0.62 |     4.8 |
|   8 | claude |        4 |   3 |       19 |  15 |   3 |       51.8 |   32.8 |    59.1% | $1.69 |    $0.62 |     8.6 |
|   9 | claude |        3 |   2 |       21 |  16 |   4 |       49.4 |   28.4 |    55.8% | $1.31 |    $0.62 |     6.6 |
|  10 | claude |        4 |   3 |       24 |  18 |   5 |       53.2 |   29.2 |    54.7% | $1.43 |    $0.60 |     7.2 |
|  11 | claude |        5 |   2 |       26 |  19 |   4 |       67.0 |   41.0 |    49.3% | $1.51 |    $0.61 |     7.9 |
|  12 | claude |        2 |   0 |       26 |  18 |   4 |       63.1 |   37.1 |    44.4% | $1.10 |    $0.65 |     4.8 |
|  13 | claude |        2 |   0 |       26 |  17 |   4 |       59.3 |   33.3 |    39.9% | $1.82 |    $0.72 |     9.4 |
|  14 | claude |        3 |   0 |       26 |  15 |   6 |       43.4 |   17.4 |    32.1% | $1.71 |    $0.79 |     5.5 |
|  15 | codex  |        6 |   3 |       29 |  18 |   5 |       59.2 |   30.2 |    34.6% | $0.30 |    $0.72 |     0.4 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| claude         | Chao2     |        14 |       26 |       43.4 |   17.4 |    32.1% |       – |
| codex          | Chao2     |         1 |        6 |          – |      – |        – |       – |
| all sources    | Chao2     |        15 |       29 |       59.2 |   30.2 |    34.6% |       – |
| claude × codex | Chapman   |         – |       29 |       46.3 |   17.3 |        – |       3 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                      | where                                                                                                                               | first | claude | codex | severity |
|-----|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|------:|-------:|------:|----------|
| D1  | A lone CR left by an edit stays raw text in the overlay, so the overlay stops breaking where the canvas breaks                                                              | packages/text-dom/src/domRuns.ts:357 (normalizeSmallCaps / normalizeText)                                                           |     1 |      1 |     0 | low      |
| D2  | `setStyle` docs say it is needed only for underline/strikethrough/overline, but taking off a node-level script needs it too                                                 | packages/text-dom/src/textEditTypes.ts:160 (UseTextEditOptions.setStyle doc)                                                        |     1 |      4 |     0 | low      |
| D3  | Typing over a selection that starts at a run boundary takes the earlier run's style, but pasting over the same selection takes the first replaced character's style         | packages/text-dom/src/overlayTyping.ts:120 (onBeforeInput)                                                                          |     2 |      1 |     0 | medium   |
| D4  | The `applyStyleToSelection` doc leaves out that taking off a node-level script also needs `setStyle`/`onChange`                                                             | packages/text-dom/src/textEditTypes.ts:285 (UseTextEditReturn.applyStyleToSelection)                                                |     2 |      3 |     0 | low      |
| D5  | A paste whose preserved white space ends a block with a line feed gains an extra blank line                                                                                 | packages/text-dom/src/pasteRuns.ts:83 (htmlToRuns, write)                                                                           |     3 |      3 |     1 | medium   |
| D6  | Arming a style at a collapsed caret does not seal the undo step, so the next typed character merges into the preceding typing step                                          | packages/text-dom/src/selectionStyling.ts:139 (applyStyle, collapsed-caret arm path)                                                |     3 |      1 |     0 | low      |
| D7  | A `<br>` that closes the last line of pasted markup pastes as an extra trailing newline                                                                                     | packages/text-dom/src/pasteRuns.ts:146 (htmlToRuns, visit BR branch / lineBreak)                                                    |     4 |      1 |     0 | low      |
| D8  | Edit teardown leaves `focusRef` pointing at the removed overlay's scroller focus                                                                                            | packages/text-dom/src/useTextEdit.ts:121 (useTextEdit effect cleanup)                                                               |     4 |      1 |     0 | low      |
| D9  | `commit` / `startEdit` read a stale edit id captured from the render they were made in                                                                                      | packages/text-dom/src/useTextEdit.ts:63 (commit, `const id = editingId`)                                                            |     4 |      2 |     0 | low      |
| D10 | A run's script (super/subscript) is drawn full size in the overlay while the canvas shrinks it                                                                              | packages/text-dom/src/domRuns.ts:228 (runsToDom)                                                                                    |     5 |      1 |     0 | medium   |
| D11 | A restyle, undo, paste or small-caps resplit turns a backward selection into a forward one                                                                                  | packages/text-dom/src/overlaySelection.ts:28 (selectOffsets)                                                                        |     5 |      2 |     0 | low      |
| D12 | The overlay keeps the node style it opened with, so commit can write that stale style back over a newer one                                                                 | packages/text-dom/src/useTextEdit.ts:107 (useTextEdit effect), packages/text-dom/src/heldNodeStyle.ts:32 (restyleNode)              |     5 |      1 |     0 | medium   |
| D13 | An unclipped overlay inherits the container's CSS direction, so direction 'auto' text with no strong character lays out RTL in an RTL page while the canvas lays it out LTR | packages/text-dom/src/overlayDirection.ts:17 (applyOverlayDirection)                                                                |     6 |      1 |     0 | low      |
| D14 | A U+2028 or other non-LF hard break acts as a paragraph separator in the overlay's alignment and bidi because its stand-in holds a line feed                                | packages/text-dom/src/overlayDirection.ts:31 (overlayAlignEdge)                                                                     |     6 |      1 |     0 | low      |
| D15 | A node's `{ px }` letterSpacing is scaled by the zoom in the overlay, while the canvas keeps it in screen pixels                                                            | packages/text-dom/src/overlayPlace.ts:120 (typeset)                                                                                 |     7 |      4 |     0 | medium   |
| D16 | A CR kept before an LF draws as a space in the overlay, though the comment says it draws nothing                                                                            | packages/text-dom/src/domRuns.ts:57 (appendOverlayText)                                                                             |     7 |      1 |     0 | low      |
| D17 | Pasting through the HTML path keeps U+00A0 characters, while the plain-text path turns the same copied text into ordinary spaces                                            | packages/text-dom/src/pasteRuns.ts:127 (htmlToRuns `collapsed`, keep branch at :146)                                                |     8 |      1 |     0 | low      |
| D18 | The edit overlay reads the selection from, and listens on, the global document, so it stops responding when its container is in another document                            | packages/text-dom/src/overlayListeners.ts:75 (listenToOverlay), packages/text-dom/src/overlaySelection.ts:13 (readSelectionOffsets) |     8 |      1 |     0 | low      |
| D19 | The plain text-edit test harness keys its texts on an object that has a prototype, so keys such as inherited property names collide                                         | packages/text-dom/src/testing/textEditHarness.ts:7 (makeHarness)                                                                    |     8 |      2 |     0 | low      |
| D20 | A node's own trailing break is dropped once any browser edit leaves the text not ending in a break, and stays dropped even after a later edit restores it                   | packages/text-dom/src/overlaySeed.ts:62 (seedOverlay, `edited`)                                                                     |     9 |      1 |     0 | medium   |
| D21 | Node-level small-caps text that the browser types outside a run span is never split into small-caps pieces                                                                  | packages/text-dom/src/domRuns.ts:355 (normalizeSmallCaps, `visit` non-run branch)                                                   |     9 |      2 |     0 | low      |
| D22 | A carried edit survives its own commit when the same node is reopened before a render, so the stale carry is taken again                                                    | packages/text-dom/src/useTextEdit.ts:60 (commit), packages/text-dom/src/overlayCarry.ts:39 (takeCarry)                              |    10 |      3 |     1 | medium   |
| D23 | The test harness's dispatchBeforeInput throws when the caret is the default select-all selection                                                                            | packages/text-dom/src/testing/textEditHarness.ts:126 (dispatchBeforeInput)                                                          |    10 |      1 |     0 | low      |
| D24 | Pasted markup keeps text that is hidden with display: none                                                                                                                  | packages/text-dom/src/pasteRuns.ts:133 (htmlToRuns visit)                                                                           |    10 |      2 |     1 | low      |
| D25 | A line break typed at the start of a break stand-in trades places with the stand-in's own break                                                                             | packages/text-dom/src/domRuns.ts:44 (restoreBreak)                                                                                  |    11 |      2 |     0 | low      |
| D26 | Turning off a node-level underline when no style writer is set still rewrites the runs                                                                                      | packages/text-dom/src/selectionStyling.ts:93 (useSelectionStyling applyStyle)                                                       |    11 |      1 |     0 | low      |
| D27 | A <br> nested inside a break stand-in is dropped by textContent serialization, so the offsets and the serialized runs disagree by one                                       | packages/text-dom/src/domRuns.ts:77 (domToRuns)                                                                                     |    15 |      0 |     1 | medium   |
| D28 | An input that arrives before selectionchange spends the armed style at a caret other than the one where it was armed                                                        | packages/text-dom/src/overlayTyping.ts:129 (onBeforeInput)                                                                          |    15 |      0 |     1 | medium   |
| D29 | overlayAlignEdge reads textContent, which merges DOM block paragraphs, so direction 'auto' alignment picks the wrong edge                                                   | packages/text-dom/src/overlayDirection.ts:31 (overlayAlignEdge)                                                                     |    15 |      0 |     1 | medium   |
