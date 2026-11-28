# hud: saturation

Repeated blind reviews of the area `hud` (24 files, 2269 lines) at the frozen commit
`6be7338b8b`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 5.3 known defects per thousand lines, at least 5. The next defect should cost about $0.80. `skulkr scour report hud` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        5 |   5 |        5 |   5 |   0 |          – |      – |        – | $0.18 |    $0.04 |     0.2 |
|   2 | claude |        5 |   4 |        9 |   8 |   1 |       25.0 |   16.0 |    64.0% | $1.32 |    $0.17 |     2.3 |
|   3 | claude |        3 |   1 |       10 |   8 |   1 |       31.3 |   21.3 |    54.7% | $0.97 |    $0.25 |     2.6 |
|   4 | claude |        3 |   1 |       11 |   8 |   2 |       23.0 |   12.0 |    42.9% | $1.02 |    $0.32 |     3.1 |
|   5 | claude |        5 |   1 |       12 |   7 |   3 |       18.5 |    6.5 |    27.5% | $0.80 |    $0.36 |     2.8 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        5 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |        9 |       13.7 |    4.7 |    24.7% |       – |
| all sources    | Chao2     |         5 |       12 |       18.5 |    6.5 |    27.5% |       – |
| codex × claude | Chapman   |         – |       12 |       19.0 |    7.0 |        – |       2 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                         | where                                                                                             | first | codex | claude | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | An unrelated pointer release or cancel cancels every open HUD press, including held widgets and presses on other canvases                                                      | packages/hud/src/openPresses.ts:30                                                                |     1 |     1 |      4 | medium   |
| D2  | useHud's attach effect omits canvasRef from its deps, so a new ref object leaves the HUD on the old canvas                                                                     | packages/hud/src/react/useHud.ts:37                                                               |     1 |     1 |      0 | medium   |
| D3  | Layer cache calls widget deps without focusVisible, unlike the draw cache, so a focus-ring-only change leaves stale commands on screen                                         | packages/hud/src/attach.ts:110                                                                    |     1 |     1 |      0 | low      |
| D4  | Accessibility mirror erases the host canvas's preexisting aria-owns and aria-activedescendant                                                                                  | packages/hud/src/accessibleMirror.ts:70                                                           |     1 |     1 |      0 | medium   |
| D5  | Captured drag calls a removed or disposed widget's handler on later moves and on end                                                                                           | packages/hud/src/tool.ts:109                                                                      |     1 |     1 |      1 | medium   |
| D6  | A failed attach leaves its surface key in the contribution's surfaces set                                                                                                      | packages/hud/src/tool.ts:221 (createHudContribution attach)                                       |     2 |     0 |      3 | low      |
| D7  | Pending sweep timeouts outlive watch's unwatch and still fire after it                                                                                                         | packages/hud/src/openPresses.ts:39 (sweep)                                                        |     2 |     0 |      1 | low      |
| D8  | glyphCommands hard-codes the icon frame and stroke width instead of using the values @weasel-js/icons exports                                                                  | packages/hud/src/glyph.ts:142 (glyphCommands), packages/hud/src/glyph.ts:11 (ROOT)                |     2 |     0 |      2 | low      |
| D9  | A closing tag whose opening tag the tag regex failed to match pops the parent frame                                                                                            | packages/hud/src/glyph.ts:33 (tags), packages/hud/src/glyph.ts:154 (glyphCommands)                |     2 |     0 |      1 | low      |
| D10 | The hidden IME input is positioned only when the edit changes, so it is left behind when the canvas moves on the page                                                          | packages/hud/src/textInputHost.ts:46 (sync)                                                       |     3 |     0 |      2 | low      |
| D11 | Switching apps or windows blurs the document, which drops HUD keyboard focus and ends a running text edit                                                                      | packages/hud/src/domFocus.ts:70 (wireFocus onBlur); packages/hud/src/textInputHost.ts:94 (onBlur) |     4 |     0 |      1 | low      |
| D12 | The hit walk stops at the first widget it hits, even one that claims only some gestures, so a gesture that widget declines goes to the scene instead of the widgets beneath it | packages/hud/src/attach.ts:79 (widgetAt)                                                          |     5 |     0 |      1 | medium   |
