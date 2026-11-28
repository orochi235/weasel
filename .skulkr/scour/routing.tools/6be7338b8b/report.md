# routing.tools: saturation

Repeated blind reviews of the area `routing.tools` (25 files, 2569 lines) at the frozen commit
`6be7338b8b`, with no fixes between them, from `claude`, `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 10.1 known defects per thousand lines, at least 5. The next defect should cost about $1.70. `skulkr scour report routing.tools` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | claude |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $1.05 |    $0.53 |     3.0 |
|   2 | claude |        2 |   1 |        3 |   2 |   1 |        4.0 |    1.0 |    25.0% | $0.90 |    $0.65 |     2.0 |
|   3 | claude |        3 |   3 |        6 |   5 |   1 |       14.3 |    8.3 |    59.5% | $0.81 |    $0.46 |     3.1 |
|   4 | claude |        3 |   3 |        9 |   8 |   1 |       33.0 |   24.0 |    73.8% | $0.94 |    $0.41 |     3.2 |
|   5 | claude |        2 |   1 |       10 |   8 |   2 |       22.8 |   12.8 |    59.3% | $0.75 |    $0.45 |     2.8 |
|   6 | claude |        3 |   1 |       11 |   8 |   2 |       24.3 |   13.3 |    48.5% | $0.84 |    $0.48 |     3.4 |
|   7 | claude |        4 |   2 |       13 |  10 |   0 |       51.6 |   38.6 |    52.6% | $0.56 |    $0.45 |     2.3 |
|   8 | claude |        3 |   0 |       13 |   9 |   1 |       48.4 |   35.4 |    39.7% | $0.77 |    $0.51 |     2.5 |
|   9 | claude |        3 |   1 |       14 |   9 |   2 |       32.0 |   18.0 |    34.1% | $0.58 |    $0.51 |     2.1 |
|  10 | claude |        1 |   0 |       14 |   9 |   2 |       32.2 |   18.2 |    33.0% | $0.64 |    $0.56 |     1.8 |
|  11 | claude |        2 |   0 |       14 |   9 |   1 |       50.8 |   36.8 |    31.4% | $0.54 |    $0.60 |     2.1 |
|  12 | claude |        2 |   0 |       14 |   9 |   1 |       51.1 |   37.1 |    29.4% | $0.67 |    $0.65 |     2.3 |
|  13 | claude |        2 |   0 |       14 |   9 |   1 |       51.4 |   37.4 |    27.6% | $0.75 |    $0.70 |     2.5 |
|  14 | claude |        2 |   0 |       14 |   9 |   1 |       51.6 |   37.6 |    26.0% | $0.61 |    $0.74 |     2.6 |
|  15 | claude |        3 |   1 |       15 |   8 |   3 |       25.0 |   10.0 |    20.5% | $1.11 |    $0.77 |     4.4 |
|  16 | claude |        2 |   1 |       16 |   9 |   3 |       28.7 |   12.7 |    22.1% | $0.86 |    $0.77 |     3.0 |
|  17 | claude |        2 |   0 |       16 |   9 |   3 |       28.7 |   12.7 |    21.1% | $0.60 |    $0.81 |     2.1 |
|  18 | claude |        1 |   0 |       16 |   9 |   3 |       28.8 |   12.8 |    20.6% | $0.56 |    $0.85 |     2.1 |
|  19 | claude |        1 |   0 |       16 |   9 |   3 |       28.8 |   12.8 |    20.2% | $0.69 |    $0.89 |     2.2 |
|  20 | claude |        1 |   0 |       16 |   9 |   3 |       28.8 |   12.8 |    19.8% | $0.59 |    $0.93 |     2.0 |
|  21 | claude |        2 |   0 |       16 |   9 |   3 |       28.9 |   12.9 |    18.9% | $0.54 |    $0.96 |     2.0 |
|  22 | claude |        6 |   3 |       19 |  10 |   5 |       28.5 |    9.5 |    18.4% | $0.79 |    $0.85 |     3.0 |
|  23 | claude |        4 |   1 |       20 |  11 |   4 |       34.5 |   14.5 |    19.0% | $0.66 |    $0.84 |     2.6 |
|  24 | claude |        1 |   0 |       20 |  11 |   4 |       34.5 |   14.5 |    18.7% | $0.57 |    $0.87 |     2.2 |
|  25 | claude |        2 |   1 |       21 |  12 |   4 |       38.3 |   17.3 |    19.8% | $0.60 |    $0.86 |     2.4 |
|  26 | claude |        2 |   0 |       21 |  12 |   4 |       38.3 |   17.3 |    19.2% | $0.83 |    $0.90 |     2.9 |
|  27 | claude |        2 |   0 |       21 |  12 |   4 |       38.3 |   17.3 |    18.6% | $0.86 |    $0.94 |     3.0 |
|  28 | claude |        2 |   0 |       21 |  11 |   5 |       32.7 |   11.7 |    16.4% | $0.62 |    $0.97 |     2.5 |
|  29 | claude |        2 |   0 |       21 |  11 |   5 |       32.7 |   11.7 |    15.9% | $0.64 |    $1.00 |     2.4 |
|  30 | claude |        5 |   1 |       22 |  10 |   6 |       30.1 |    8.1 |    13.3% | $0.80 |    $0.99 |     3.5 |
|  31 | codex  |        8 |   4 |       26 |  13 |   7 |       37.7 |   11.7 |    15.7% | $0.28 |    $0.85 |     0.3 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| claude         | Chao2     |        30 |       22 |       30.1 |    8.1 |    13.3% |       – |
| codex          | Chao2     |         1 |        8 |          – |      – |        – |       – |
| all sources    | Chao2     |        31 |       26 |       37.7 |   11.7 |    15.7% |       – |
| claude × codex | Chapman   |         – |       26 |       40.4 |   14.4 |        – |       4 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                         | where                                                                                              | first | claude | codex | severity |
|-----|----------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|------:|-------:|------:|----------|
| D1  | A conflict is lost when another tie among different bindings uses the same spec objects                                                                        | packages/routing/src/tools/routing/reflection/conflicts.ts:131 (addConflict)                       |     1 |      5 |     1 | medium   |
| D2  | `ToolsApi.hotkeyEngaged` can name another canvas's tool                                                                                                        | packages/routing/src/tools/useTools.ts:211 (useTools)                                              |     1 |      5 |     0 | low      |
| D3  | describeShortcuts merges an action group named `other` into the ungrouped "Other" group                                                                        | packages/routing/src/tools/describeShortcuts.ts:150 (describeShortcuts)                            |     2 |      2 |     0 | low      |
| D4  | describeShortcuts lists a tool's declared bindings without applying binding overrides, so a rebound tool key shows its old shortcut                            | packages/routing/src/tools/describeShortcuts.ts:120 (toolBindingsByAction / describeShortcuts)     |     3 |     21 |     1 | medium   |
| D5  | A shared number option held at ±Infinity reads as the default instead of being clamped, for a tool whose leaf is not endless                                   | packages/routing/src/tools/toolOptions.ts:141 (readHeld)                                           |     3 |      1 |     0 | low      |
| D6  | findScopedConflicts looks up an entry's eligible rule by ownerId, so a tool that shares an id with a gated action inherits that action's rule                  | packages/routing/src/tools/routing/reflection/conflicts.ts:91 (findConflictsKeyed, ruleOf)         |     3 |      2 |     0 | low      |
| D7  | liveTool picks a held tool that the active mode bars, so tool options and step keys follow a tool that input does not route to                                 | packages/routing/src/tools/toolOptions.ts:116 (liveTool)                                           |     4 |      3 |     1 | medium   |
| D8  | useToolOptionParams passes values.subscribe to useSyncExternalStore unbound, losing its `this`                                                                 | packages/routing/src/tools/useToolOptionValues.ts:33 (useToolOptionParams)                         |     4 |      3 |     0 | low      |
| D9  | A conflict's ownerIds can include two bindings that never tie with each other, because tie components are merged transitively                                  | packages/routing/src/tools/routing/reflection/conflicts.ts:94 (findConflictsKeyed / tieComponents) |     4 |     13 |     0 | low      |
| D10 | toolOptionsPrefs silently ignores a host shared default whose key no tool names                                                                                | packages/routing/src/tools/toolOptionPrefs.ts:141 (toolOptionsPrefs)                               |     5 |      1 |     0 | low      |
| D11 | A hotkey-tier action that shadows an ambient tool's binding is never reported as a conflict, though the same shadow over a registry tool is                    | packages/routing/src/tools/routing/reflection/conflicts.ts:302 (findScopedConflicts)               |     6 |      1 |     0 | low      |
| D12 | The shadow pass misses a hotkey-tier action that outranks a tool's binding at a different specificity or target                                                | packages/routing/src/tools/routing/reflection/conflicts.ts:302 (findScopedConflicts, shadow loop)  |     7 |      1 |     0 | low      |
| D13 | withoutTools gives an unlabeled tool set the heading "<Id> without"                                                                                            | packages/routing/src/tools/toolSet.ts:77 (withoutTools)                                            |     7 |      1 |     0 | low      |
| D14 | foldPlatformCopies folds away a binding duplicated with `mod` so it is never reported as a conflict, though the same duplicate spelled with `ctrl` is reported | packages/routing/src/tools/routing/reflection/conflicts.ts:186 (foldPlatformCopies)                |     9 |      2 |     0 | low      |
| D15 | toolOptionsPrefs throws a misleading "would share one place" error when one tool is listed twice                                                               | packages/routing/src/tools/toolOptionPrefs.ts:101 (placeToolGroup)                                 |    15 |      2 |     0 | low      |
| D16 | findScopedConflicts reports one self-collision twice when a group pass joins a third binding to it                                                             | packages/routing/src/tools/routing/reflection/conflicts.ts:285 (findScopedConflicts)               |    16 |      1 |     0 | low      |
| D17 | A wheel reversal steps immediately or only after 60px of travel, depending on whether the leftover travel is exactly 0                                         | packages/routing/src/tools/toolOptionSteps.ts:113 (wheelSizeAction run)                            |    22 |      1 |     1 | low      |
| D18 | ToolsScope remounts its children when `isolate` or an outer scope changes                                                                                      | packages/routing/src/tools/toolsScope.tsx:53 (ToolsScope)                                          |    22 |      1 |     0 | low      |
| D19 | onSwitch can fire twice for one dropped tool                                                                                                                   | packages/routing/src/tools/useToolLifecycle.ts:42 (useToolLifecycle effect)                        |    22 |      1 |     0 | low      |
| D20 | withToolOptionDefault installs a caller's starting value without checking it against the option's leaf                                                         | packages/routing/src/tools/toolOptions.ts:85 (withToolOptionDefault)                               |    23 |      2 |     0 | low      |
| D21 | A dotted tool id whose parent has no options gets a prefs group with an empty name                                                                             | packages/routing/src/tools/toolOptionPrefs.ts:84 (placeToolGroup)                                  |    25 |      2 |     0 | low      |
| D22 | A shared number option's widened leaf keeps the first tool's clearable, scale, stops and step, which may not hold over the merged range                        | packages/routing/src/tools/toolOptionPrefs.ts:58 (widenedNumber)                                   |    30 |      1 |     0 | low      |
| D23 | Ingest bindings with overlapping but different MIME filters are bucketed apart, so real ties go unreported                                                     | packages/routing/src/tools/routing/reflection/conflicts.ts:90 (findConflictsKeyed)                 |    31 |      0 |     1 | low      |
| D24 | phasesTie's 1 << n enumeration overflows at 31+ channels so identical phase lists fail to tie, and blows up near 30                                            | packages/routing/src/tools/routing/reflection/conflictKeys.ts:103 (phasesTie)                      |    31 |      0 |     1 | medium   |
| D25 | Releasing a programmatic hotkey hold pops the last same-id entry, removing a later keyboard hold's priority                                                    | packages/routing/src/tools/useTools.ts:244 (disengageHotkey)                                       |    31 |      0 |     1 | medium   |
| D26 | steppedOption's 12-significant-digit cleanup can move a large value by more than the step                                                                      | packages/routing/src/tools/toolOptions.ts:226 (steppedOption)                                      |    31 |      0 |     1 | medium   |
