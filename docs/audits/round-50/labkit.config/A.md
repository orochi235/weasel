# Audit round 50 — labkit.config findings

## sectionTree judges conditions without the schema the config is drawn over, unlike every panel surface
- where: packages/labkit/src/config/sectionTree.ts:86,178,200 (prune, sectionTree) and packages/labkit/src/config/railConditions.ts:137 (configVerdict)
- scenario: a schema built with `f.schema(nodes, { over: appPrefs })` whose leaf says `.showIf({ path: 'view.grid', is: true })` or `.enableIf(...)` naming a path only `over` holds. `panelRows`, `labSource`, `ControlMatrix` and `MatrixRow` all call `isRowVisible`/`isRowEnabled` with `over`, so the condition reads the over value (or that leaf's default) through `conditionReader`. `sectionTree` calls `isRowVisible(resolved, path, config, showHidden)` with no `over`, and `configVerdict` builds `prefJudge(resolved.group, (at) => configValueAt(config, at))` with no `over` either, so the same condition reads `undefined` from the trial config: the rail form hides or disables rows the panel shows enabled (or the reverse), and an `is` test of an encoded over leaf compares without its encoding. `resolved.over` is right there on the `ResolvedConfig` and is never consulted.
- evidence: read
- severity: medium

## An f.object / f.list / f.map / f.union inner node bypasses the rule chain and drops its options
- where: packages/labkit/src/config/compound.ts:44 (itemLeaf)
- scenario: `itemLeaf` copies `node.annotations` and takes the kind from `typeof node.default`; it never runs `applyRules` (neither the lab's `configRules` nor `builtinRules`), and ignores `node.options` entirely. So (a) `f.object({ fillColor: f.value('#fff') })` under a lab rule "every `*Color` key is a color" resolves to a `string` field, while the same `fillColor: f.value('#fff')` under `f.group` resolves to `color` — one declaration answered two ways; `f.value([1, 2])` as a field throws where at the top level `kindFromValue` makes it a `list`; `f.number(0).range(0, 9)` as a field gets no `control: 'slider'` from `sliderWhenBounded`. (b) a field's `.showIf(fn)`/`.enableIf(fn)` (function form, stored in `options`), `.render()`, `.dialog()`, `.auto()`/`.initial(AUTO)`/`.quote()` are silently discarded with no warning — only the data-condition forms survive because those live in `annotations`.
- evidence: read
- severity: low

## fromPrefs exempts a section's switch leaf by member key, but inside a group's object the condition paths are root paths
- where: packages/labkit/src/config/fromPrefs.ts:103,110 (sectionLeaves) via branchOf → shapeOf(leaf.children, path, …)
- scenario: `configFromPrefs` first runs `resolvePrefGroupConditions`, so every condition path is read from the root (`grid.on`). For a section inside a group's `object` leaf (`group` mark, as `prefsFromConfig` writes and `PrefSchemaEditor` edits), `sectionLeaves` gets the object's children, whose keys are relative (`on`). `reads.includes(key)` compares `['grid.on']` against `'on'`, never matches, so the section's own switch leaf gets the section's `enableIf` folded onto it: turn the switch off and its row disables itself, and it can't be turned back on. At the top level keys are whole paths, so the same schema works there.
- evidence: read
- severity: low

## prefsFromConfig drops the schema's admitted selectors, so f.prefs(prefsFromConfig(r)) loses them
- where: packages/labkit/src/config/toPrefs.ts:143 (prefsFromConfig); packages/labkit/src/config/fromPrefs.ts:205 (configFromPrefs)
- scenario: `f.schema(nodes).admits('doc')` resolves to a group carrying `admits: ['doc']`. `prefsFromConfig` returns `{ name, members }` only, and `configFromPrefs` never returns `admitted`, so the documented round trip ("the shape `PrefSchemaEditor` opens and `f.prefs` reads back") yields a schema whose `.per('doc')` scopes now name a selector that is neither a pref nor admitted — a schema problem `checkPrefScopes` reports.
- evidence: read
- severity: low

## A resolver that enumerates its config sees only the auto paths already resolved, so declaration order still decides
- where: packages/labkit/src/config/autoConfig.ts:108 (demand)
- scenario: auto paths `a` and `b` at the top level, `a` declared first, `a`'s resolver `(c) => pick(Object.entries(c))` or `({ ...c })` or `'b' in c`. Every auto path is dropped from `out` before resolving; the proxy forces a path only in its `get` trap. `ownKeys`, `has` and `getOwnPropertyDescriptor` read `out` as it stands, so `b` (not yet resolved) is absent from the spread/entries/`in` test, while had `b` been declared first it would be present with its resolved value. The docstring says this "makes declaration order irrelevant"; for any access that is not a named property read it does not. `has`/`ownKeys` should force every unresolved top-level auto key first (cycle detection still applies).
- evidence: read
- severity: low

## The demand proxy breaks its invariants when the config it was given is frozen
- where: packages/labkit/src/config/autoConfig.ts:113 (demand) with :65-66 (resolveAutoConfig)
- scenario: `resolveAutoConfig` is exported. Given a frozen config holding none of the auto paths, `dropAtPath` returns the input unchanged, so the proxy's target is that frozen object. Once one resolver writes a new top-level key (`out = withConfigValueAt(out, 'n', 5)`), a later resolver doing `Object.keys(c)` or `{ ...c }` makes `ownKeys` report a key the non-extensible target lacks, and `getOwnPropertyDescriptor` report a property as existent on it — both throw `TypeError` (proxy invariant). The target should be a fresh object (e.g. `{}` or a copy), since every trap reads `read()` anyway.
- evidence: read
- severity: low

## titleCase fuses an acronym into the following word
- where: packages/labkit/src/config/rules.ts:5 (titleCase)
- scenario: the split only breaks between a lowercase letter/digit and an uppercase one, then lowercases everything: `maxURLLength` → "Max urllength", `useGPUCache` → "Use gpucache", `rawHTMLText` → "Raw htmltext". Every unlabeled leaf, group, object field and union variant gets its label from this (`labelFromKey`, `itemLeaf`, `resolveEntry`). An uppercase run followed by a capitalized word needs its own break (`(?<=[A-Z])(?=[A-Z][a-z])`).
- evidence: read
- severity: low

## f.custom's validate is lost by prefsFromConfig / f.prefs
- where: packages/labkit/src/config/toPrefs.ts:42 (leafOf); packages/labkit/src/config/fromPrefs.ts:28 (optionsOn)
- scenario: `f.custom(kind, def, validate)` keeps `validate` in `NodeOptions`, and forge's protocol (`packages/forge/src/protocol/schema.ts`) reads `entry.options.validate` from the schema's nodes. `prefsFromConfig` writes a node's `render`, `dialog`, `showWhen`, `enableWhen` (and the leaf already carries `autoResolve`/`autoQuote`) beside its prefs fields, but never `validate`, and `optionsOn` reads none back. A schema round-tripped through `PrefSchemaEditor`/`f.prefs` silently stops reporting that leaf's errors.
- evidence: read
- severity: low

## BaseNode.auto's docstring still names the removed `auto` export
- where: packages/labkit/src/config/baseNode.ts:167 (BaseNode.auto doc)
- scenario: the doc tells authors to "add `BaseNode.initial`(auto)"; since 7a9be10759 labkit exports `AUTO` (`index.ts:1`) and no `auto`, so following it fails to compile. `.initial`'s own error text says "takes `auto`" too (line 186), naming a value that no longer exists.
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

<!-- done: 9 findings, files read: 28 -->
