# routing.interactions.actions: saturation

Repeated blind reviews of the area `routing.interactions.actions` (36 files, 4087 lines) at the frozen commit
`758e1efac7`, with no fixes between them, from `claude`, `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 5.4 known defects per thousand lines, at least 5. The next defect should cost about $0.79. `skulkr scour report routing.interactions.actions` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | claude |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $1.62 |    $0.81 |     5.1 |
|   2 | claude |        2 |   1 |        3 |   2 |   1 |        4.0 |    1.0 |    25.0% | $1.22 |    $0.95 |     2.8 |
|   3 | claude |        1 |   0 |        3 |   2 |   0 |        3.7 |    0.7 |    40.0% | $1.95 |    $1.60 |     6.2 |
|   4 | claude |        2 |   1 |        4 |   3 |   0 |        6.3 |    2.3 |    42.9% | $2.48 |    $1.82 |     5.3 |
|   5 | claude |        3 |   3 |        7 |   6 |   0 |       19.0 |   12.0 |    60.0% | $3.15 |    $1.49 |     7.3 |
|   6 | codex  |        9 |   8 |       15 |  13 |   1 |       85.4 |   70.4 |    66.4% | $0.30 |    $0.71 |     0.4 |
|   7 | claude |        2 |   1 |       16 |  14 |   1 |      100.0 |   84.0 |    65.1% | $1.63 |    $0.77 |     3.0 |
|   8 | claude |        4 |   2 |       18 |  15 |   2 |       67.2 |   49.2 |    57.8% | $1.99 |    $0.80 |     4.7 |
|   9 | claude |        3 |   1 |       19 |  16 |   1 |      132.8 |  113.8 |    56.3% | $1.92 |    $0.86 |     4.2 |
|  10 | claude |        3 |   3 |       22 |  19 |   1 |      184.5 |  162.5 |    60.6% | $1.10 |    $0.79 |     3.8 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| claude         | Chao2     |         9 |       14 |       72.7 |   58.7 |    54.5% |       – |
| codex          | Chao2     |         1 |        9 |          – |      – |        – |       – |
| all sources    | Chao2     |        10 |       22 |      184.5 |  162.5 |    60.6% |       – |
| claude × codex | Chapman   |         – |       22 |       74.0 |   52.0 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                        | where                                                                                                                                                       | first | claude | codex | severity |
|-----|---------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|------:|-------:|------:|----------|
| D1  | An action without `requires` gets a different deps bag from `trigger`/`begin`/`preview` than from its own bindings                                            | packages/routing/src/interactions/actions/ActionsProvider.tsx:47 (depsFor)                                                                                  |     1 |      7 |     0 | medium   |
| D2  | A merged tuning form loses the added form's name when the action's own form has no name                                                                       | packages/routing/src/interactions/actions/tunedForm.ts:27 (formWith)                                                                                        |     1 |      1 |     0 | low      |
| D3  | The last-operation wrapper seals history after an ongoing action's start instead of before, so an edit made in start coalesces with the gesture's later stops | packages/routing/src/interactions/actions/lastOperation.ts:283 (LastOperationKeeper.ongoing)                                                                |     2 |      1 |     0 | low      |
| D4  | An unparseable binding override warns again on every change to the actions tree                                                                               | packages/routing/src/interactions/actions/bindingOverrides.ts:42 (resolveBindingOverrides), called from ActionsProvider.tsx:152 (ActionsNode.overridesHere) |     4 |      3 |     0 | low      |
| D5  | withRoleMods widens a binding for a role whose old keys only an earlier role's widening admitted                                                              | packages/routing/src/interactions/actions/modifierRoles.ts:72 (withRoleMods)                                                                                |     5 |      1 |     0 | low      |
| D6  | pushOwner's release removes the newest copy of a value pushed twice, reordering the stack                                                                     | packages/routing/src/interactions/actions/scopeNode.ts:123 (pushOwner)                                                                                      |     5 |      1 |     1 | medium   |
| D7  | A grouped settings form's default change params use a dotted flat key while its values and the last operation are nested                                      | packages/routing/src/interactions/actions/actionSettings.ts:56 (actionSettingsParams)                                                                       |     5 |      1 |     0 | medium   |
| D8  | A variant key can equal another action's id, so a saved menu entry resolves to the wrong action                                                               | packages/routing/src/interactions/actions/actionItems.ts:41 (actionItems)                                                                                   |     6 |      0 |     1 | medium   |
| D9  | handleWith's proxy breaks on a frozen handle, so reading a method throws a TypeError                                                                          | packages/routing/src/interactions/actions/handleWith.ts:11 (handleWith)                                                                                     |     6 |      0 |     1 | medium   |
| D10 | Held-key preview and release check enabled without the view id and with a made-up world point, unlike the dispatcher's admission                              | packages/routing/src/interactions/actions/holdPreview.ts:58 (holding)                                                                                       |     6 |      0 |     1 | medium   |
| D11 | After an id change, drive sends the new action's input to the previous action's open control                                                                  | packages/routing/src/interactions/actions/useOngoingAction.ts:56 (drive)                                                                                    |     6 |      0 |     1 | medium   |
| D12 | begin admits the child's action, but an inherited parent dispatcher starts the parent's implementation without its gate                                       | packages/routing/src/interactions/actions/ActionsProvider.tsx:327 (registry.begin)                                                                          |     6 |      0 |     1 | medium   |
| D13 | Adjusting an immediate last operation replays raw given params, so the current tuning changes params the form doesn't show                                    | packages/routing/src/interactions/actions/lastOperation.ts:275 (LastOperationKeeper.wrap)                                                                   |     6 |      0 |     1 | medium   |
| D14 | A mixed modifier/letter held-key alias lets Ctrl/Cmd+letter start the offhand tool and blocks the browser chord                                               | packages/routing/src/interactions/actions/toolOffhand.ts:56 (heldKeySpec)                                                                                   |     6 |      0 |     1 | low      |
| D15 | Shortcut lookup evaluates params thunks for bindings that have no displayable shortcut, and one can throw                                                     | packages/routing/src/interactions/actions/actionShortcuts.ts:76 (bindingShortcuts)                                                                          |     6 |      0 |     1 | low      |
| D16 | A tuning's params never reach ctx.params of a UI-driven ongoing action begun without params                                                                   | packages/routing/src/interactions/actions/tuning.ts:93 (wrapInvoker, ongoing start)                                                                         |     7 |      1 |     0 | low      |
| D17 | trigger reports true ("it ran") when the action's run threw                                                                                                   | packages/routing/src/interactions/actions/ActionsProvider.tsx:300 (registry.trigger)                                                                        |     8 |      1 |     0 | low      |
| D18 | A hold made by holdPreview keeps the label of the descriptor it was made from, not the live one it follows                                                    | packages/routing/src/interactions/actions/holdPreview.ts:46 (holdingLive)                                                                                   |     8 |      1 |     0 | low      |
| D19 | Tuned, session and binding params merge shallowly, so a nested param group loses leaves                                                                       | packages/routing/src/interactions/actions/tuning.ts:160 (tunedParams)                                                                                       |     9 |      1 |     0 | low      |
| D20 | holdPreview of a legacy-bag action with an `eligible` rule passes only `ruleCtx`, losing every other dep                                                      | packages/routing/src/interactions/actions/holdPreview.ts:52 (holding)                                                                                       |    10 |      1 |     0 | medium   |
| D21 | adjust stores session params for an action whose tuning `keep`s them, so they surface once that tuning is removed                                             | packages/routing/src/interactions/actions/lastOperation.ts:259 (LastOperationKeeper.adjust → remember)                                                      |    10 |      1 |     0 | low      |
| D22 | A yoke member mounted under another `<ActionsProvider>` takes that provider's menu host instead of its yoke tree's                                            | packages/routing/src/interactions/actions/inputScope.tsx:68 (Provide)                                                                                       |    10 |      1 |     0 | low      |
