# Audit round 59 — ui.components.PanelCells

## An action field of an object leaf never draws pressed in a selection panel: `leafContext` hands no `activeAt`
- where: packages/ui/src/components/PanelCells/panelCells.ts:61-87 (leafContext)
- scenario: a node kind's schema has an object leaf `data.style` whose children include an `action` field with an
  `activeIf` that holds. `applyPrefConditions` walks into object fields (`prefs-schema/src/status.ts:88-96`) and puts
  `data.style.<action>` in `applied.active`, which `conditionedSections` copies into `active`. But `leafContext` turns
  `scope.active` only into `active` for the leaf's own key, never into `activeAt`, so `objectFieldContext`
  (`active: ctx.activeAt?.(path) === true`) answers false for every field, and `entryApplier` (Prefs/entry.ts:49-50)
  likewise for an action inside a list or map entry. The form path does it right (`PrefsRow.tsx:164` sets
  `activeAt: (at) => ctx.active.has(at)`), so the same schema draws the action pressed in PrefsForm and unpressed in
  SelectionPanel. Should hand `activeAt: (at) => scope.active.has(at)` (or the alias targets' equivalent) as it does
  `disabledAt`/`hiddenAt`.
- evidence: read
- severity: medium

## `panelSource` indexes leaves by `path`, so two leaves sharing a path (an alias and its target, or two aliases) answer each other's state and reset
- where: packages/ui/src/components/PanelCells/panelSource.ts:32-54 (panelSource: byPath, keyOf, stateAt, reset)
- scenario: model.ts says "two aliases of one leaf share a `path`", and an alias without `over` points into its own
  kind's schema, so a panel can hold both `data.fill` (target) and an alias `fillAlias` whose `path` is also
  `data.fill`. `byPath` keeps only the last of them, so `stateAt('data.fill')` reads `disabled`/`hidden`/`active` under
  the alias's key. If the alias's own `enableIf` disables it while the target is enabled, `resetReader`
  (`prefs/src/sources/policy.ts:10`) sees the target's path as disabled, `panelResets` returns nothing for the target's
  row, and that row (drawn enabled, since `leafContext` keys `disabled` by `panelLeafKey`) loses its reset; the reverse
  case offers a reset on a disabled alias row. `write`/`reset` also hand `writes` the last `PanelLeaf` for the path
  rather than the one edited. The state lookup should be keyed by the leaf drawn, not by its path.
- evidence: read
- severity: low

## `panelMarkedPaths` pairs an object leaf's fields across section boundaries and inside bars, where `ObjectLeaf` draws them apart
- where: packages/ui/src/components/PanelCells/selection.tsx:37-48 (sharedRows), against ObjectLeaf.tsx:21-41 (fieldPairs) and Prefs/objectRows.tsx:128-146 (barNodes)
- scenario: `sharedRows` flattens an object leaf's children with `prefSectionLeaves` and runs `pairRows` over the
  whole list. `ObjectLeaf` instead pairs only within one run of neighboring fields (`fieldPairs` flushes at each
  nested section, as `objectRows` ends a run there), and in a nested section `as: 'bar'` it draws each non-flag cell
  under its own path (only a run of flags fuses). (a) Children `{ a: {pair:{with:'X.b'}}, sec: { members: { b } } }`:
  `ObjectLeaf` draws `a` and `b` in separate rows, but `sharedRows` sees them adjacent and maps `X.b → X.a`, so
  selecting `X.b` marks `a`'s row and nothing on `b`'s. (b) A nested bar section holding a paired `[number, toggle]`:
  the bar draws two cells keyed by their own paths, but selecting the toggle marks the number's cell. The top level
  handles both (`panelItems` flushes at sections; `rowsIn(true)`/`fusedFlags` treats bars apart); object fields
  answer the same question the other way.
- evidence: read
- severity: low

## An alias of an object leaf is marked under its own key but its fields are drawn under the target's path
- where: packages/ui/src/components/PanelCells/selection.tsx:21-31,44 (panelShownPath, sharedRows) vs objectField.tsx:62-65 / objectFieldRows.tsx:72 (cell key = `childCtx.path`)
- scenario: `flatten` turns an alias `styleAlias → data.style` (an object leaf) into `{ path: 'data.style', own:
  'styleAlias' }`. `panelMarkedPaths` builds `drawn` from `panelLeafKey` and descends with `${at}.${key}`, so selecting
  `styleAlias.bold` yields the mark `styleAlias.bold`. `ObjectLeaf` builds each field's context from `ctx.path`
  (`objectFieldContext` → `data.style.bold`, since `leafContext` passes `panelLeaf.path`) and its rows carry
  `selectionAttrs('data.style.bold', …)`. No element carries the mark, so the selected field is never marked or
  scrolled to; `sharedRows` likewise pairs fields under `styleAlias.*` while `fieldPairs`/`pair.with` name
  `data.style.*`, so a pair inside the aliased object maps nothing.
- evidence: read
- severity: low

## Across several kinds, every node is read, bounded, written and reset under the first kind's leaf
- where: packages/ui/src/components/PanelCells/model.ts:218-251 (effectiveSections: `leafKey`, `keep`, `flatFirst.map(narrow)`)
- scenario: the intersection matches a leaf only by `(key, kind)` and keeps the first kind's `PrefLeaf` object for
  everyone. Select a `rect` whose schema has `data.radius: { kind: 'number', default: 0, max: 50, absentIsDefault: true }`
  and a `star` whose `data.radius` is `{ kind: 'number', default: 20, max: 500 }`. The panel draws the rect's leaf:
  the star's absent radius reads as the rect's default 0 (`nodeLeafValue` in `panelSource`/`leafContext`), the
  control refuses anything over 50 and `boundAt` in `writeLeaf` clamps the star to 50 though its own schema allows
  500, and the row's reset (`prefStoredReset(leaf.leaf)` per `LeafWrites.reset`) writes 0 into the star, not its own
  20. The same goes for an enum whose options differ (the second kind's extra options vanish, or the first's are
  offered to a kind that rejects them). The doc says only the *layout* is the first kind's; what each node is read and
  written under should be its own kind's leaf, or a leaf whose differing fields disqualify the match.
- evidence: read
- severity: medium

## A glyph-named flag toggle in an object leaf's paired row takes an even share of the row
- where: packages/ui/src/components/PanelCells/PanelCells.module.css:82-90 (`.rowControls > .namedField`, `:has(> .toggle)`)
- scenario: `renderField` wraps a field in `.namedField` when it is paired or `block` and has an `icon`. The exemption
  from `flex: 1 1 0` covers only a wrapped `.toggle`; a wrapped boolean `control: 'toggle'` or a clearable enum toggle
  carries `.flagToggle` instead (`renderLeaf.tsx:29,34`), so it gets an equal split of the row and its one-letter
  segments are flung across it — what the `.rowControls > .flagToggle { flex: 0 0 auto }` rule (lines 113-117) exists
  to prevent for an unwrapped one. The `:has()` should name `.flagToggle` too.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/PanelCells/LabeledRow.tsx
packages/ui/src/components/PanelCells/ObjectLeaf.tsx
packages/ui/src/components/PanelCells/PanelCells.module.css
packages/ui/src/components/PanelCells/cells.tsx
packages/ui/src/components/PanelCells/conditions.ts
packages/ui/src/components/PanelCells/index.ts
packages/ui/src/components/PanelCells/model.ts
packages/ui/src/components/PanelCells/nodeBounds.ts
packages/ui/src/components/PanelCells/objectField.tsx
packages/ui/src/components/PanelCells/objectFieldRows.tsx
packages/ui/src/components/PanelCells/panelCells.ts
packages/ui/src/components/PanelCells/panelSections.tsx
packages/ui/src/components/PanelCells/panelSource.ts
packages/ui/src/components/PanelCells/renderContext.ts
packages/ui/src/components/PanelCells/renderLeaf.tsx
packages/ui/src/components/PanelCells/selection.tsx

<!-- done: 6 findings, files read: 16 -->
