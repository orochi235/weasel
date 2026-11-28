# routing.tools review saturation

Snapshot: 6be7338b8bdce6605ac6e3dc75ee21365f18be5e

Scope is the 25 paths in `/private/tmp/skulkr-saturation/lists/routing.tools.txt`, listed below. HEAD matched the requested snapshot and the worktree was clean. Adjacent code and tests were read to trace contracts. Evidence is from source inspection.

## Pass ledger

Each pass searched for defects with the previous passes' context available.

| Pass | Focus | New | Cumulative | No-new streak |
| --- | --- | ---: | ---: | ---: |
| 1 | Route projection, matcher parity, and conflict identity | 3 | 3 | 0 |
| 2 | Held-tool ownership and capability changes through assembly and tuning | 2 | 5 | 0 |
| 3 | Option stepping at numeric and input-stream boundaries | 2 | 7 | 0 |
| 4 | Shortcut reflection from binding overrides through the sheet | 1 | 8 | 0 |
| 5 | Shared prefs ownership, dotted paths, and colliding schema entries | 0 | 8 | 1 |
| 6 | Scope publisher replacement, restoration, and effect cleanup | 0 | 8 | 2 |
| 7 | Tool authoring, exported helpers, nested set traversal, and introspection | 0 | 8 | 3 |

Stopped after three consecutive complete passes added zero distinct findings.

## Findings index

| ID | Severity | Finding |
| --- | --- | --- |
| RT-001 | Low | MIME buckets miss real ingest ties |
| RT-002 | Medium | Phase-state enumeration fails with enough named channels |
| RT-003 | Low | Reused spec objects collapse distinct conflicts |
| RT-004 | Medium | Programmatic release can remove a later same-tool key hold |
| RT-005 | Medium | Mode filtering and option tuning disagree on the live tool |
| RT-006 | Low | A wheel reversal is delayed when accumulated travel is zero |
| RT-007 | Medium | Precision cleanup changes a valid numeric step |
| RT-008 | Low | The shortcut sheet shows authored tool bindings after overrides |

## RT-001 — MIME buckets miss real ingest ties

- where: packages/routing/src/tools/routing/reflection/conflicts.ts:90 (`findConflictsKeyed`)
- severity: low
- evidence: read
- scenario: Register two ambient drop bindings with the same target, phase and modifiers, one with `types: ['image/*']` and the other with `types: ['image/png']`. Drop a PNG. Both pass `matchIngestTypes` and have the same exactness rank. A mixed payload can also satisfy two disjoint MIME filters, since the matcher checks each binding against every item. The diagnostic puts the different filter strings in separate buckets and reports no tie. It should flag the bindings when an accepted payload can place them at equal rank.

## RT-002 — Phase-state enumeration fails with enough named channels

- where: packages/routing/src/tools/routing/reflection/conflictKeys.ts:103 (`phasesTie`)
- severity: medium
- evidence: read
- scenario: Give two equal-rank bindings on the same owner identical nonempty phase lists naming 29 distinct channels, with every atom requiring engaged. The owner and the additional sentinel bring the count to 31. The signed expression `1 << 31` is negative, so no state is tested and even identical phase lists fail to tie. With 28 distinct channels each and no overlap between the bindings' channel names, the shift count likewise wraps. At 30 total channels, a pair with incompatible constraints can instead search over a billion states. The detector should determine whether the phase conditions overlap without enumerating the power set.

## RT-003 — Reused spec objects collapse distinct conflicts

- where: packages/routing/src/tools/routing/reflection/conflicts.ts:132 (`addConflict`)
- severity: low
- evidence: read
- scenario: Reuse one key spec object in four bindings with different action IDs. Give two bindings only view A and the other two only view B. Each view creates its own two-binding component. The conflict key uses the identical two spec identities and identical modifiers for both components, so the second component disappears before scoped deduplication sees it. Both same-view pairs should be reported.

## RT-004 — Programmatic release can remove a later same-tool key hold

- where: packages/routing/src/tools/useTools.ts:244 (`disengageHotkey`, also the cleanup at line 237)
- severity: medium
- evidence: read
- scenario: Programmatically hold tool A, hold tool B, then engage A with its offhand key while idle between gestures. The shared stack is now A, B, A. Release the programmatic A hold through the API instance that created it. The API remembers only the string A and `ToolNode.popHotkey` removes the last matching ID, so the stack becomes A, B and B takes priority even though A's key is still down. Releasing the programmatic hold should remove the first A and preserve the keyboard hold's priority.

## RT-005 — Mode filtering and option tuning disagree on the live tool

- where: packages/routing/src/tools/tuneToolOptions.ts:32 (`tuneToolOptions`)
- severity: medium
- evidence: read
- scenario: Configure tools A and B to tune the same action with different defaults. Keep A focused and engage B, whose capabilities the current mode disallows. This is reachable through `ToolsApi.engageHotkey`, which checks registry membership. Assembly filters B out and A handles the gesture. The tuner selects B from the raw held stack and injects B's defaults into the action, or enables B's step actions in place of A's. Option values and step eligibility should follow the mode-eligible routed tool.

## RT-006 — A wheel reversal is delayed when accumulated travel is zero

- where: packages/routing/src/tools/toolOptionSteps.ts:120 (`wheelSizeAction`)
- severity: low
- evidence: read
- scenario: With an unbounded size and a one-unit step, deliver a Shift+wheel event with deltaY -60 followed by +60 within 150 ms. The first event grows the size and resets travel to zero. A common small opposite delta, such as +10 in place of +60, then takes no step because the fresh-burst test cannot see the previous direction at zero travel. The same issue occurs after any exact multiple of the threshold has been removed from the accumulator. An immediate reversal should start a fresh step consistently, regardless of the residual travel.

## RT-007 — Precision cleanup changes a valid numeric step

- where: packages/routing/src/tools/toolOptions.ts:226 (`steppedOption`)
- severity: medium
- evidence: read
- scenario: Step up from 1000000000009 on an unbounded number leaf with `step: 0.2` and `plus: 0.2`. The computed grid step is approximately 1000000000009.2. Converting it to 12 significant digits gives 1000000000010. It clears both the direction and bounds tests and is returned, even though it advances by 1 instead of 0.2. Cleanup should preserve the chosen step and remove only floating-point noise.

## RT-008 — The shortcut sheet shows authored tool bindings after overrides

- where: packages/routing/src/tools/describeShortcuts.ts:131 (`toolBindingsByAction`)
- severity: low
- evidence: read
- scenario: Give a tool a key binding with an explicit ID targeting a registered command. Unbind that ID through `bindingOverrides`, or override it to another key. Runtime assembly uses `overriddenBindings`, while the sheet receives the raw tools registry and this helper reads `tool.bindings` verbatim. The command row shows the old shortcut. It should show the replacement or omit the unbound key, as it already does for the action's own bindings.

## Files read

packages/routing/src/tools/defineTool.ts
packages/routing/src/tools/describeShortcuts.ts
packages/routing/src/tools/returnToModeDefault.ts
packages/routing/src/tools/routeTypes.ts
packages/routing/src/tools/routing/gestures.ts
packages/routing/src/tools/routing/index.ts
packages/routing/src/tools/routing/reflection/conflictKeys.ts
packages/routing/src/tools/routing/reflection/conflicts.ts
packages/routing/src/tools/routing/reflection/index.ts
packages/routing/src/tools/routing/reflection/registry.ts
packages/routing/src/tools/routing/routeGrammar.ts
packages/routing/src/tools/toolGaps.ts
packages/routing/src/tools/toolOptionPrefs.ts
packages/routing/src/tools/toolOptionSteps.ts
packages/routing/src/tools/toolOptions.ts
packages/routing/src/tools/toolSet.ts
packages/routing/src/tools/toolShortcuts.ts
packages/routing/src/tools/toolsScope.tsx
packages/routing/src/tools/tuneToolOptions.ts
packages/routing/src/tools/types.ts
packages/routing/src/tools/useModeDefaultTool.ts
packages/routing/src/tools/useToolLifecycle.ts
packages/routing/src/tools/useToolOptionValues.ts
packages/routing/src/tools/useToolShortcuts.ts
packages/routing/src/tools/useTools.ts

<!-- done: 8 findings, files read: 25 -->
