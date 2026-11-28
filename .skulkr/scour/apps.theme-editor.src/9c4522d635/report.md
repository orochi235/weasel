# apps.theme-editor.src: saturation

Repeated blind reviews of the area `apps.theme-editor.src` (50 files, 5879 lines) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: the next defect would cost about $1.75, over the limit of $1.49 (3× the $0.50 going rate). The next defect should cost about $1.75. `skulkr scour report apps.theme-editor.src` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.16 |    $0.08 |     0.1 |
|   2 | claude |        2 |   2 |        4 |   4 |   0 |        7.0 |    3.0 |   100.0% | $1.44 |    $0.40 |     2.9 |
|   3 | claude |        2 |   2 |        6 |   6 |   0 |       16.0 |   10.0 |   100.0% | $1.25 |    $0.47 |     4.4 |
|   4 | claude |        2 |   1 |        7 |   6 |   1 |       20.5 |   13.5 |    67.5% | $1.00 |    $0.55 |     3.7 |
|   5 | claude |        5 |   5 |       12 |  11 |   1 |       60.4 |   48.4 |    80.9% | $1.12 |    $0.41 |     3.8 |
|   6 | claude |        2 |   0 |       12 |   9 |   3 |       23.3 |   11.3 |    52.9% | $0.81 |    $0.48 |     2.7 |
|   7 | claude |        1 |   1 |       13 |  10 |   3 |       27.3 |   14.3 |    56.8% | $1.14 |    $0.53 |     4.0 |
|   8 | claude |        3 |   1 |       14 |   9 |   5 |       21.1 |    7.1 |    40.9% | $1.15 |    $0.58 |     4.5 |
|   9 | claude |        1 |   0 |       14 |   9 |   4 |       23.0 |    9.0 |    40.5% | $1.22 |    $0.66 |     3.5 |
|  10 | claude |        2 |   1 |       15 |  10 |   3 |       30.0 |   15.0 |    42.6% | $1.17 |    $0.70 |     4.2 |
|  11 | claude |        4 |   3 |       18 |  12 |   4 |       34.4 |   16.4 |    43.3% | $1.55 |    $0.67 |     5.1 |
|  12 | claude |        2 |   1 |       19 |  13 |   4 |       38.4 |   19.4 |    44.0% | $1.57 |    $0.72 |     6.0 |
|  13 | claude |        2 |   1 |       20 |  13 |   5 |       35.6 |   15.6 |    40.7% | $2.13 |    $0.79 |     7.0 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |        12 |       19 |       32.2 |   13.2 |    39.8% |       – |
| all sources    | Chao2     |        13 |       20 |       35.6 |   15.6 |    40.7% |       – |
| codex × claude | Chapman   |         – |       20 |       29.0 |    9.0 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                         | where                                                                                                                           | first | codex | claude | severity |
|-----|----------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Inspector ignores inline declarations, so it reports a stylesheet token that has lost the cascade to an inline style                                           | apps/theme-editor/src/theme/inspect.ts:74                                                                                       |     1 |     1 |      3 | medium   |
| D2  | Reload completion increments a generation shared by every workbench key, so a pending reload of theme A remounts theme B's workbench and drops its local state | apps/theme-editor/src/ThemeEditor.tsx:106                                                                                       |     1 |     1 |      0 | low      |
| D3  | Jumping from the inspector to an inherited pins-only token opens the Pins page, which does not list that token                                                 | apps/theme-editor/src/theme/model.ts:66 (jumpLayerFor)                                                                          |     2 |     0 |      3 | medium   |
| D4  | Turning "Varies by <axis>" off and back on rewrites a non-mode variation as a mode variation                                                                   | apps/theme-editor/src/layers/SemanticDrawer.tsx:186 (setVaries)                                                                 |     2 |     0 |      1 | low      |
| D5  | A categorical ramp's plain `surface` gate is neither editable nor shown in the gates editor                                                                    | apps/theme-editor/src/layers/RampsLayer.tsx:118 (GatesEditor)                                                                   |     3 |     0 |      1 | low      |
| D6  | A pinned semantic with no generated value shows `undefined` as its "Rule produced" text                                                                        | apps/theme-editor/src/theme/semantics.ts:107 (semanticRows)                                                                     |     3 |     0 |      2 | low      |
| D7  | Click-to-inspect counts token declarations inside an unmet @container, @scope or @starting-style rule as applying to the element                               | apps/theme-editor/src/theme/inspect.ts:77 (tokensReadAt, applies)                                                               |     4 |     0 |      1 | low      |
| D8  | A draft left for a theme whose file was deleted becomes an undiscardable theme entry that can only fail to reload                                              | apps/theme-editor/src/ThemeEditor.tsx:23 (withUnsavedDrafts); apps/theme-editor/src/ThemeWorkbench.tsx:220 (dead-draft actions) |     5 |     0 |      1 | medium   |
| D9  | Jump-to-token builds an unescaped attribute selector that throws on a token name containing `"` or `\`                                                         | apps/theme-editor/src/TokenLayer.tsx:35 (TokenLayer effect)                                                                     |     5 |     0 |      2 | low      |
| D10 | tokensReadAt never visits rules from @import-ed stylesheets, so tokens declared there are missed                                                               | apps/theme-editor/src/theme/inspect.ts:84 (tokensReadAt, visit)                                                                 |     5 |     0 |      1 | low      |
| D11 | A reference field being edited closes mid-typing when the store normalizes the value that was set                                                              | apps/theme-editor/src/TokenReference.tsx:32 (TokenReference)                                                                    |     5 |     0 |      2 | low      |
| D12 | Scale parameter sliders clamp a theme's own value when it falls outside their fixed ranges                                                                     | apps/theme-editor/src/layers/ScalesLayer.tsx:22 (PARAMS)                                                                        |     5 |     0 |      1 | low      |
| D13 | A saved undo history containing a malformed step crashes the page at mount on every load                                                                       | apps/theme-editor/src/useLabHistory.ts:25 (stepsBackTo)                                                                         |     7 |     0 |      1 | low      |
| D14 | The app root never sets overflow: hidden, so the narrow workbench makes the whole document grow and scroll                                                     | apps/theme-editor/src/app.css:1 (html, body, #root)                                                                             |     8 |     0 |      2 | low      |
| D15 | Click-to-inspect never counts tokens read by ::before / ::after rules, so tokens used only by an element's pseudo-elements go unreported                       | apps/theme-editor/src/theme/inspect.ts:36 (specificityAt), apps/theme-editor/src/theme/inspect.ts:10 (matches)                  |    10 |     0 |      2 | low      |
| D16 | A saved history whose last step is a coalesced burst is dropped instead of stepped back to the state the page opens on                                         | apps/theme-editor/src/useLabHistory.ts:30 (stepsBackTo)                                                                         |    11 |     0 |      1 | medium   |
| D17 | Dragging a lightness slider on a ramp with no `lightness` writes an object instead of the two-number tuple                                                     | apps/theme-editor/src/theme/ramps.ts:84 (writeParam)                                                                            |    11 |     0 |      1 | low      |
| D18 | The hex Pin button pins an already-pinned color, giving the generator two identical anchors                                                                    | apps/theme-editor/src/SwatchPanel.tsx:172 (Pin button / add)                                                                    |    11 |     0 |      1 | low      |
| D19 | A negative px value in a scale draws a full-width ladder bar                                                                                                   | apps/theme-editor/src/layers/ScalesLayer.tsx:126 (ScaleSection)                                                                 |    12 |     0 |      1 | low      |
| D20 | Click-to-inspect never reports tokens read through a custom property declared in an element's inline style                                                     | apps/theme-editor/src/theme/inspect.ts:91 (tokensReadAt)                                                                        |    13 |     0 |      1 | medium   |
