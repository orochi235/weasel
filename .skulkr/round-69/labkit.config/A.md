# Audit round 69 — labkit.config

## configFromPrefs silently drops leaves when a dotted member key and a group/leaf at its prefix both appear
- where: packages/labkit/src/config/fromPrefs.ts:124 (place), :174 (shapeOf.add)
- scenario: a `PrefSection` whose members are `{ 'grid.size': numberLeaf, grid: <object leaf marked group> }` (or a plain leaf `grid` before `'grid.size'`). `place` for `'grid.size'` makes an implied branch at `grid`; placing `grid` next does `setOwn(shape, 'grid', branch)`, replacing the implied branch, so `grid.size` vanishes from `nodes` while its path is still in `leaves` and still written by `defaults()`. In the other order the outcome is different: a group first gets `size` merged into it, and a plain leaf `grid` first gets replaced by a branch without a word (`!('children' in branch)`), so its node disappears while `defaults()` writes it and then overwrites it. The result depends on member order, and no error is raised. It should either merge consistently or throw on the collision.
- evidence: read
- severity: medium

## isRowVisible/isRowEnabled look up an `over` alias target's path in the panel's own predicate maps
- where: packages/labkit/src/config/visible.ts:79 (statusAt)
- scenario: a schema drawn `over` another, with `f.alias('view.grid')` pointing into `over`. `targets` comes from `over`, so `target.path` is a path in the `over` schema. The loop still runs `resolved.showIf.get(at)` / `resolved.enableIf.get(at)` over that path's prefixes, and those maps are keyed by paths in the panel's *own* schema. An own-schema `.showIf(fn)` on an own group `view` then hides an alias whose target is the unrelated `over` leaf `view.grid`. Without `over`, the target lives in the own schema and the lookup is correct. The function walk should run only when the target is in `resolved.group`.
- evidence: read
- severity: low

## isConfigNodeShown judges data conditions without `over`, unlike isRowVisible
- where: packages/labkit/src/config/visible.ts:192 (isConfigNodeShown)
- scenario: a schema built with `f.schema(nodes, { over })` where a node says `.showIf({ path: 'theme', is: 'dark' })` and `theme` is a setting of `over`. `isRowVisible` reads that path through `conditionReader(resolved, config, over)`, which falls back to `over`'s default. `isConfigNodeShown` (used by forge's protocol/schema.ts and frame/index/variants.ts) builds `prefJudge(schema, (at) => configValueAt(config, at))` with no `over`, so it reads `undefined` there (or fails to resolve the path). The same node is then hidden in one walk and shown in the other. It takes no `over` argument and never reads `ResolvedConfig.over`.
- evidence: read
- severity: low

## configFromPrefs' defaults() hands out each leaf's own default object, where f.schema deep-copies
- where: packages/labkit/src/config/fromPrefs.ts:222 (configFromPrefs defaults)
- scenario: `f.prefs(section)` with a list, object or map leaf: `defaults()` writes `storedDefault(leaf)`, which is `leaf.default` itself, so every trial's starting config and the schema leaf share one array or record. `f.schema`'s `shapeDefaults` runs `copyTree` for this reason. Any in-place edit of a trial's config value (or of one trial's defaults) then changes the schema's default and every other trial opened from it. The same question gets two answers in the two builders.
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
