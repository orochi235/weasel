# Findings: labkit.config (round 50)

## A section's enableIf switch inside a group's `object` leaf is disabled by its own section
- where: packages/labkit/src/config/fromPrefs.ts:110 (sectionLeaves)
- scenario: `f.prefs` over a schema where a `group`-marked `object` leaf `grid` holds a section with `enableIf: { path: 'grid.on', equals: true }` and the leaf `on` inside it. Conditions are root paths once `resolvePrefGroupConditions` has run, but `sectionLeaves` compares them against `key`, which below a group is relative (`on`). `reads.includes('on')` is false, so `on` takes the section's `enableIf` as well and is disabled while off: the switch can never be turned on. At the top level the key is the whole path, so only that case works.
- evidence: read
- severity: medium

## sectionTree and configVerdict ignore the schema's `over`, so a rail form shows and disables rows the panel does not
- where: packages/labkit/src/config/sectionTree.ts:86, :178, :200 (prune, sectionTree); packages/labkit/src/config/railConditions.ts:137 (configVerdict)
- scenario: `f.schema({ a: f.number(1).showIf({ path: 'view.grid', equals: true }) }, { over })`, where `view.grid` is a leaf of `over` defaulting to true. `ControlPanel` judges with `over ?? resolved.over` (ControlPanel.tsx:285), and `visible.ts`'s `conditionReader` reads `view.grid` through `prefReader(over, config)`, so `a` shows. `sectionTree` calls `isRowVisible` with no `over`, and `configVerdict` judges with `configValueAt(config, at)` only, so `view.grid` reads `undefined` and `a` is dropped from the rail (an `enableIf` the same way lands in `disabledPaths`). They should pass `resolved.over` the way the panel does.
- evidence: read
- severity: medium

## `f.custom`'s `validate` is stored and never run
- where: packages/labkit/src/config/builder.ts:321-325 (f.custom); packages/labkit/src/config/resolve.ts:175-185 (resolveEntry)
- scenario: `f.custom('vec', [0, 0], (leaf, c) => c.vec.length === 2 ? [] : ['two numbers'])`. The function goes into `options.validate` (typed in `NodeOptions` as "Errors for this leaf under `config`"), but `resolveEntry` copies only `autoResolve`, `autoQuote` and `auto` off the options onto the leaf, `prefsFromConfig` and `configFromPrefs` don't carry it, and nothing in labkit reads `options.validate` (grep finds only the type and the builder). A bad value is never reported; the third argument is silently dropped.
- evidence: read (grep over packages/labkit/src for `validate`)
- severity: medium

## `f.curve().range()` accepts bounds `f.number().range()` rejects
- where: packages/labkit/src/config/curveNode.ts:9 (CurveNode.range)
- scenario: `f.curve([0, 0, 1, 1]).range(1, 0)` or `.range(0, NaN)` is taken as is, where `NumberNode.range` throws through `checkedBounds` on a non-finite bound or `min > max`. The curve's y bound then holds an inverted or NaN range, and the field clamps every point against it, where the same mistake on a number fails at declaration. The bounds check is one decision answered two ways.
- evidence: read
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

<!-- done: 4 findings, files read: 28 -->
