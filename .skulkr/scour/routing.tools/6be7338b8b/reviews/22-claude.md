# routing.tools findings

## A conflict names bindings that do not tie with each other, through transitive grouping
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:111 (findConflictsKeyed / tieComponents)
- scenario: three bindings land in one bucket (same key, mods, target, rank), and `ties` is pairwise (views, phases, rules). A has `views: ['x']`, B `views: ['x','y']`, C `views: ['y']`. A–B tie in view x and B–C tie in view y, but A and C never tie. `tieComponents` takes the connected component {A,B,C} and reports one conflict whose `ownerIds` are A, B and C, which `formatConflict` prints as "declared by A, B, C". The same happens with phases (A `initial`, B unrestricted, C `engaged`) or with mutually exclusive `eligible` rules joined by an ungated binding. It should report the pairs (or cliques) that actually tie, A+B and B+C.
- evidence: read
- severity: low
- fix: packages/routing/src/tools/routing/reflection/conflicts.ts
- size: function
- cause: connected components used where ties are not transitive
- confidence: sure

## A wheel reversal steps at once or only after 60px, depending on whether the leftover travel is exactly 0
- where: packages/routing/src/tools/toolOptionSteps.ts:113 (wheelSizeAction run)
- scenario: inside a burst, a reversal counts as a fresh burst only when `burst.travel !== 0`. After the first event (travel reset to 0), or after a run of deltas that used up its travel exactly (say +60 → one step, remainder 0), a reversed delta is not fresh. It is added to the travel and needs a full `WHEEL_SIZE_STEP_PX` before stepping. Had the remainder been +1px, the same reversal would step at once. One notch the other way right after a first notch (a mouse wheel at 120px per notch within 150 ms) therefore steps the reversed way only once the reversed travel reaches 60px, not on its first notch as "the first event of a burst steps at once" promises. The burst should carry its direction separately from `travel`.
- evidence: read
- severity: low
- fix: packages/routing/src/tools/toolOptionSteps.ts
- size: line
- cause: direction inferred from residual travel
- confidence: sure

## An action whose `group` is `'other'` is merged into the ungrouped rows
- where: packages/routing/src/tools/describeShortcuts.ts:150 (describeShortcuts)
- scenario: an action declares `group: 'other'`. Its rows go into the same `commands` bucket as every ungrouped action (`action.group ?? OTHER`), and that bucket is moved last and labeled "Other" instead of "Other" in first-registered order. The two cannot be told apart. Tool sets reserve the id and throw (`describeTools`), but command groups silently merge, so one id is answered two ways in one function. Either reject it the same way or key ungrouped rows apart from any group id.
- evidence: read
- severity: low
- fix: packages/routing/src/tools/describeShortcuts.ts
- size: line
- cause: sentinel group id shared with user-keyed ids
- confidence: sure

## `ToolsScope` remounts its children when `isolate` or an outer scope changes
- where: packages/routing/src/tools/toolsScope.tsx:53 (ToolsScope)
- scenario: `ToolsScope` returns a fragment when an outer slot is in scope and `isolate` is false, and a `ToolsSlotContext.Provider` otherwise. Toggling `isolate`, or an outer `ToolsScope` mounting or unmounting above it, swaps the element type at that position. React then unmounts and remounts the whole subtree: canvases lose their state, scene and GL contexts, and they re-publish. It should keep one element shape, for example always render the Provider with `value={outer && !isolate ? outer : own}`.
- evidence: read
- severity: low
- size: line
- cause: conditional element type at a fixed tree position
- confidence: sure

## `onSwitch` can fire twice for one dropped tool
- where: packages/routing/src/tools/useToolLifecycle.ts:42 (useToolLifecycle effect)
- scenario: the active tool T leaves `entriesById` while `active` still reads `T`. `dropped` is true and `onSwitch` runs (ending T's in-flight handles), and `prevActiveRef` stays `T`. When the slot is later cleared or moved (`active` becomes `null` or U, which a host or the context does after a tool is removed), `switched` is true, so `onSwitch` runs a second time for the same outgoing tool and may end handles the incoming state already started. A drop should record that T's switch has been handled, for example by setting `prevActiveRef` to `null`.
- evidence: read
- severity: low
- size: line
- cause: drop path leaves prevActiveRef pointing at the ended tool
- confidence: likely

## Conflict rules are looked up by owner id, so a tool sharing an action's id inherits its `eligible` rule
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:103 (findConflictsKeyed ruleOf)
- scenario: `rules` maps action id → rule, and `ruleOf` reads `rules.get(entry.ownerId)` for every entry, tools and contributions included. A registry or ambient tool whose id equals a gated action's id (tool and action ids are separate namespaces) gets that action's rule. Two of its bindings then go unreported against another entry wherever `rulesExclusive` or the modes rule the borrowed rule out, even though the tool's bindings are always eligible. Rules should be keyed by the action entries themselves (or the entry object), not by the bare id.
- evidence: read
- severity: low
- size: function
- cause: id-keyed rule table spans two namespaces
- confidence: likely

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

<!-- done: 6 findings, files read: 25 -->
