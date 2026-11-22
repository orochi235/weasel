# labkit.config — reviewer findings

## isConfigNodeShown reads a condition on an `over` path as undefined, where isRowVisible reads that leaf's default
- where: packages/labkit/src/config/visible.ts:187 (isConfigNodeShown)
- scenario: schema built `f.schema({ angle: f.number(0).showIf({ path: 'view.grid', is: true }) }, { over })` where `view.grid` is a leaf of `over` defaulting `true`. `isRowVisible(resolved, 'angle', {}, false, over)` reads through `conditionReader`, finds `over`'s default and says shown; `isConfigNodeShown(angle, {}, resolved.group)` judges with `configValueAt(config, at)` only, reads `undefined`, and says hidden. The same visibility question is answered two ways; the exported helper has no way to take `over`.
- evidence: read
- severity: medium

## `.auto()` with no resolver keeps a resolver an earlier `.auto(fn)` set
- where: packages/labkit/src/config/baseNode.ts:171 (BaseNode.auto)
- scenario: a base node `const n = f.number(4).auto(fromData)` reused as `n.auto()` for a leaf whose instrument should work the value out itself. `opt` merges the patch over the old options, and the no-resolver branch never clears `autoResolve`, so the leaf still computes `fromData` instead of reading `undefined` as the doc ("without, it reads `undefined` and the instrument substitutes its own value") promises. The clone-to-reuse pattern the class doc advertises is exactly what hits it.
- evidence: read
- severity: low

## Writing `AUTO` at a group path pins every leaf under it and records the group path as unpinned
- where: packages/labkit/src/config/autoConfig.ts:164 (applyConfigWrite) / :183 (withoutAuto)
- scenario: `setConfig('grid', AUTO)` (an action's writer, or a reset written as a bare sentinel) with `grid.size` auto: `under` removes `grid.size` from the set, `withoutAuto` pushes `'grid'` itself, and `resolveAutoConfig` only consults leaf paths, so `grid.size` is now pinned at its held value and `'grid'` sits in the set matching no leaf. The write meant "everything here auto" and did the opposite.
- evidence: read
- severity: low

## fromPrefs: a group `object` leaf placed after a dotted key into the same branch overwrites it, dropping the earlier leaves
- where: packages/labkit/src/config/fromPrefs.ts:124 (place), :178 (shapeOf add)
- scenario: a hand-written `PrefSection` with members `{ 'grid.extra': leaf, grid: <object leaf marked group> }`. The first creates an implicit branch `grid` holding `extra`; the second `place(shape, 'grid', branch)` `setOwn`s over it, so `grid.extra` has no row, while `leaves` still holds `['grid.extra', leaf]` and `defaults()` writes a value for it. In the other order the leaf is merged in. Member order decides whether a leaf exists.
- evidence: read
- severity: low

## useOverAccess outside a lab hands an instrument a writer that silently drops writes
- where: packages/labkit/src/config/over.ts:68 (useOverAccess)
- scenario: an instrument whose schema has `over`, rendered without a surrounding `<Lab>` (a story, a standalone trial): `lab` is null, `read` gives defaults, and `set` is `lab?.set(...)`, a no-op, so an edit to an over value never lands and nothing says so. A lab with no `over` given keeps values itself (`useKeptOver`); this path neither keeps them nor returns `undefined`.
- evidence: read
- severity: low

## fieldSweep sweeps an enum's disabled options
- where: packages/labkit/src/config/fieldSweep.ts:21 (fieldSweep, enum branch)
- scenario: `f.enum('a', [{ value: 'a', label: 'A' }, { value: 'x', label: 'X', disabled: true }])` — `ConfigOption.disabled` is "shown but cannot be chosen: a value the control reports and cannot author", yet the sweep walks `x` and writes it, which the field's own control never offers. The doc says the sweep is "the values a config field's own control offers".
- evidence: read
- severity: low

## fieldSweep labels a unit'd number with the raw float and ignores `.display`
- where: packages/labkit/src/config/fieldSweep.ts:34 (label)
- scenario: `f.number(0).range(0, Math.PI).step(Math.PI / 4).unit({ suffix: '°', scale: Math.PI / 180 })` labels steps `45.00000000000001 °`-style from `String(unit.toDisplay(v))`, and a `.display(compact())` leaf's sweep reads `2000000` where its control reads `2.00M`. The sweep's labels disagree with the control the doc says it mirrors.
- evidence: read (float noise inferred from the arithmetic, not run)
- severity: low

## Files read
packages/labkit/src/config/auto.ts
packages/labkit/src/config/autoConfig.ts
packages/labkit/src/config/autoReports.ts
packages/labkit/src/config/baseNode.ts
packages/labkit/src/config/builder.ts
packages/labkit/src/config/compound.ts
packages/labkit/src/config/curveNode.ts
packages/labkit/src/config/declarationEmit.fixture.ts
packages/labkit/src/config/drawsOwn.ts
packages/labkit/src/config/fieldSweep.ts
packages/labkit/src/config/fromPrefs.ts
packages/labkit/src/config/headingLeaf.ts
packages/labkit/src/config/index.ts
packages/labkit/src/config/leaves.ts
packages/labkit/src/config/numberNode.ts
packages/labkit/src/config/over.ts
packages/labkit/src/config/path.ts
packages/labkit/src/config/railConditions.ts
packages/labkit/src/config/resolve.ts
packages/labkit/src/config/rules.ts
packages/labkit/src/config/sectionTree.ts
packages/labkit/src/config/storedDefault.ts
packages/labkit/src/config/stutter.ts
packages/labkit/src/config/toPrefs.ts
packages/labkit/src/config/types.ts
packages/labkit/src/config/useConfigSchema.ts
packages/labkit/src/config/useResolvedConfig.ts
packages/labkit/src/config/visible.ts

<!-- done: 7 findings, files read: 28 -->
