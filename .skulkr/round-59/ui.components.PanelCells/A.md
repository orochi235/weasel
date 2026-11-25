I wasn't allowed to write `.skulkr/out/findings.md`, so the full findings document is below.

# Audit round 59: ui.components.PanelCells (blind reviewer)

## Fields of an aliased object leaf are tagged by the target's path, but `panelMarkedPaths` answers with the alias's key, so marks and tab leads never reach them
- where: packages/ui/src/components/PanelCells/objectField.tsx:65 (objectFieldCell), packages/ui/src/components/PanelCells/selection.tsx:92-99 (panelMarkedPaths), packages/ui/src/components/PanelCells/ObjectLeaf.tsx:81 (tabs `holds`)
- scenario: a schema has an object leaf `data.style` and an alias `look` that points at it. `flatten` turns the alias into `{ path: 'data.style', own: 'look' }`.
  - The block row is tagged `look`, because `blockRow` uses `panelLeafKey`.
  - The fields are tagged by `childCtx.path`, which is built from `ctx.path` (`data.style`), giving `data.style.fontSize`.
  - `panelMarkedPaths` keys `drawn` by `panelLeafKey` (`look`) and builds field paths as `${at}.${key}`. Selecting `look.fontSize` returns `look.fontSize`, which no element carries. Selecting `data.style.fontSize` returns null unless the target is also drawn. Either way the field row is never marked.
  - ObjectLeaf's tab strip checks `${ctx.path}.${key}` (the target's path) against `marks.lead`, so a lead inside a tab of an aliased object never opens that tab.
- evidence: read
- severity: medium

## `panelSource` keeps one PanelLeaf per path, so `stateAt` and reset gating answer for whichever leaf sharing a path came last
- where: packages/ui/src/components/PanelCells/panelSource.ts:32-36,51-54 (`byPath` / `keyOf` / `stateAt`)
- scenario: model.ts says two aliases of one leaf share a `path`, and an alias that `flatten` resolves shares its target's path. `new Map(leaves.map(l => [l.path, l]))` keeps only the last one, so `stateAt(path)` reads the `disabled`, `hidden` and `active` sets under the last leaf's key.
  - Suppose an alias has its own `showIf`, `enableIf` or `activeIf`, different from its target's. Then the target's context takes the alias's `active`, because `leafContext` only overrides `active` when it is true. `sourceResetPlan`, which reads `stateAt`, then gates the target's reset on the alias's enabled state.
  - `leafContext` reads `disabled` and `hidden` straight from the sets by `panelLeafKey`. So the same question is answered two ways in two places.
- evidence: read
- severity: low

## `sharedRows` pairs an object's fields across a section, but `fieldPairs` (which draws them) ends a run at a section
- where: packages/ui/src/components/PanelCells/selection.tsx:42-44 (sharedRows) vs packages/ui/src/components/PanelCells/ObjectLeaf.tsx:21-41 (fieldPairs)
- scenario: an object's children are `{ x: a leaf whose pair names y, grp: a section holding { y, … } }`.
  - `fieldPairs` flushes the run before `grp`, so x and y are drawn in separate rows.
  - `sharedRows` runs `pairRows` over `prefSectionLeaves(children)`, which flattens the section away. x and y then sit next to each other and get paired, so `obj.y` maps to `obj.x`.
  - Selecting `obj.y` therefore marks x's row instead of y's.
- evidence: read
- severity: low

## Top-level leaves are paired across the sections between them; nested leaves are not
- where: packages/ui/src/components/PanelCells/model.ts:152-158 (flatten)
- scenario: a properties schema's members are `{ a: a leaf whose pair names b, S: a section, b: a leaf }`.
  - Inside any section, `panelItems` ends a run at a nested section, so a and b would be separate rows.
  - At the top level, every leaf goes into `untitled` regardless of the sections between them, and `pairRows(untitled)` puts a and b in one row of the leading section.
  - So the same schema shape pairs or doesn't depending on how deep it sits.
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

<!-- done: 4 findings, files read: 16 -->