# @weasel-js/prefs

## 2.0.0

### Major Changes

- 4b3a525: A linear pref unit names its decimal places `places`, as quantity's displays do; it was `precision`.
  
  The rename covers `PrefLinearUnit`, `ResolvedPrefUnit`, and the options of `prefUnit` and `unitScopedPrefUnit`.
  `PrefSchemaEditor` writes `places`. Drafts and submissions it saved with `precision` still open with the same
  rounding: they are read as `places` when loaded, and written as `places` from then on.
  
  ```ts
  // before
  const degrees = prefUnit(ANGLE_RADIANS, 'deg', { precision: 1, suffix: '°' });
  const percent: PrefLinearUnit = { scale: 0.01, precision: 0, suffix: '%' };
  // after
  const degrees = prefUnit(ANGLE_RADIANS, 'deg', { places: 1, suffix: '°' });
  const percent: PrefLinearUnit = { scale: 0.01, places: 0, suffix: '%' };
  ```
  
  <!-- entry: breaking api data -->
- 6555ec8: The set of assets an `AssetEditor` holds is an `AssetSet`, since "workspace" names the area around the page everywhere else in weasel.
  
  `Workspace`, `asWorkspace`, `workspaceCodec` and `workspaceChanges` are `AssetSet`, `asAssetSet`, `assetSetCodec` and `assetSetChanges`, and `AssetEditor`'s `workspace` prop is `assetSet`.
  
  ```tsx
  // before
  <AssetEditor workspace={workspace} original={BASE} onChange={setWorkspace} codec={workspaceCodec([])} />
  // after
  <AssetEditor assetSet={assetSet} original={BASE} onChange={setAssetSet} codec={assetSetCodec([])} />
  ```
  
  <!-- entry: breaking api -->
- 2909824: A leaf is auto only where its schema declares `auto`, so `auto: false` is gone: a leaf without `auto` is always pinned.
  
  ```ts
  // Before
  const grid = { kind: 'boolean', name: 'Grid', description: '', default: true, auto: false };
  
  // After
  const grid = { kind: 'boolean', name: 'Grid', description: '', default: true };
  // and a leaf that may be auto says so, with neither field if it needs none
  const size = { kind: 'number', name: 'Size', description: '', default: 10, auto: {} };
  ```
  
  <!-- entry: rank=10 breaking api behavior -->
- ae4a042: `checkPrefSplits` and `PrefSplitProblem` are renamed `checkPrefScopes` and `PrefScopeProblem`, after the `scopes` they validate.
  
  ```ts
  // before
  const problems: PrefSplitProblem[] = checkPrefSplits(schema);
  // after
  const problems: PrefScopeProblem[] = checkPrefScopes(schema);
  ```
  
  <!-- entry: breaking api -->
- 1e031a5: prefs' factories are spelled `create…`, like every other factory. `prefsDefaultsSource`, `prefWeightAxes` and `prefAliasTargets` are renamed `createDefaultsSource`, `createWeightAxes` and `createAliasTargets`.
  
  ```ts
  // before
  const axes = prefWeightAxes(schema);
  // after
  const axes = createWeightAxes(schema);
  ```
  
  <!-- entry: breaking api -->
- 7534a19: `@weasel-js/prefs/edit` names its alias helpers for aliases rather than pointers. `pointerTarget` is `aliasTargetIn`, `pointerAttributes` is `aliasAttributes`, `POINTER_ATTRS` is `ALIAS_ATTRS`, `deadPointers` is `deadAliases`, `pointable` is `isAliasable`, `pointersTo` is `aliasesTo` and `pointedAt` is `aliasedPaths`.
  
  ```ts
  // before
  const dead = deadPointers(layout, settings);
  const target = pointerTarget(settings, alias);
  // after
  const dead = deadAliases(layout, settings);
  const target = aliasTargetIn(settings, alias);
  ```
  
  <!-- entry: breaking api -->
- 60ca6e8: A `weasel-bundles/1` export marks a bundle that changed package with `op: 'repackage'`.
  
  `op: 'move'` now always means a member moved between bundles, an included bundle as well.
  The document's `bundles` now also lists the package holding the bundles an included bundle moved between.
  
  ```ts
  // before: a package move, and an included bundle moved between bundles, both read
  { op: 'move', kind: 'bundle', id, from, to }
  // after: a package move
  { op: 'repackage', kind: 'bundle', id, from: oldPackage, to: newPackage }
  ```
  
  <!-- entry: breaking data fix -->
- 6597fc4: `filed` from `@weasel-js/prefs/edit` is renamed `fileActions`: it adds a catalog pref for each action not yet in the catalog.
  
  ```ts
  // before
  const root = filed(catalog, actions);
  // after
  const root = fileActions(catalog, actions);
  ```
  
  <!-- entry: breaking api -->
- 15e923d: `PrefGrade` is removed: an action leaf's `grade` is `Grade` from @weasel-js/registry, the same type theme and ui use.
  
  ```ts
  import type { Grade } from '@weasel-js/registry'; // was: import type { PrefGrade } from '@weasel-js/prefs'
  ```
  
  <!-- entry: breaking -->
- 08d9309: `isShown` from `@weasel-js/prefs/edit` is renamed `isTreeAsset`. It says whether the structure tree shows an asset, which every kind but the action catalog is.
  
  ```ts
  // before
  assets.filter(isShown);
  // after
  assets.filter(isTreeAsset);
  ```
  
  <!-- entry: breaking api -->
- 07c3852: A source's `stateAt` returns a `PrefLeafStatus`: `PrefStatus`'s `shown` and `enabled`, plus `active`. It replaces `LeafState`, and `FREE_LEAF_STATUS` replaces `LEAF_FREE`.
  
  ```ts
  // before
  stateAt: (path): LeafState => ({ disabled: !on(path), hidden: !seen(path), active: false }),
  const free = LEAF_FREE;
  // after
  stateAt: (path): PrefLeafStatus => ({ enabled: on(path), shown: seen(path), active: false }),
  const free = FREE_LEAF_STATUS;
  ```
  
  <!-- entry: breaking api -->
- 93d4fce: `ONE` from `@weasel-js/prefs/edit` is renamed `LONE_SCHEMA_ID`: the asset id a lone schema is edited as.
  
  ```ts
  // before
  const mine = assets.find((a) => a.id === ONE);
  // after
  const mine = assets.find((a) => a.id === LONE_SCHEMA_ID);
  ```
  
  <!-- entry: breaking api -->
- 14143c7: `prefType` is renamed `namedPrefType`: it stamps a type name on a leaf.
  
  ```ts
  // before
  const Stop = prefType('GradientStop', leaf);
  // after
  const Stop = namedPrefType('GradientStop', leaf);
  ```
  
  <!-- entry: breaking api -->
- 0f8da6b: `carried` from `@weasel-js/prefs/edit` is renamed `outermostInOrder`: the outermost of the paths given, in schema order.
  
  ```ts
  // before
  const paths = carried(root, chosen);
  // after
  const paths = outermostInOrder(root, chosen);
  ```
  
  <!-- entry: breaking api -->
- d4532e3: `prefIsReset` is renamed `prefIsAtReset`, matching the other `…IsAtReset` checks.
  
  ```ts
  // before
  prefIsReset(leaf, { auto, value });
  // after
  prefIsAtReset(leaf, { auto, value });
  ```
  
  <!-- entry: breaking api -->
- ea67ced: `leafIsAtReset` is renamed `readingIsAtReset` and `leafAtReset` is renamed `sourceLeafIsAtReset`, so the two names no longer differ by one letter.
  
  ```ts
  // before
  leafIsAtReset(leaf, reading); leafAtReset(source, path, leaf);
  // after
  readingIsAtReset(leaf, reading); sourceLeafIsAtReset(source, path, leaf);
  ```
  
  <!-- entry: breaking api -->
- af6d87c: `resetPlanAt` is renamed `resetPlans`, since it takes a list of paths.
  
  ```ts
  // before
  resetPlanAt(schema, ['grid', 'seed'], read);
  // after
  resetPlans(schema, ['grid', 'seed'], read);
  ```
  
  <!-- entry: breaking api -->
- 4602a76: `resetReading` is renamed `resetReader`, since it returns a reader function.
  
  ```ts
  // before
  const read = resetReading(source);
  // after
  const read = resetReader(source);
  ```
  
  <!-- entry: breaking api -->
- 16ce408: A `ResetWrite`'s `write` field is renamed `value`: it holds the value the reset writes.
  
  ```ts
  // before
  for (const { path, write } of plan) set(path, write);
  // after
  for (const { path, value } of plan) set(path, value);
  ```
  
  <!-- entry: breaking api -->
- 9057ecb: `prefNumberAt` is renamed `prefBoundedNumber`: it takes a reader, not a path.
  
  ```ts
  // before
  const n = prefNumberAt(leaf, read);
  // after
  const n = prefBoundedNumber(leaf, read);
  ```
  
  <!-- entry: breaking api -->
- 1c43dbf: `prefShownValue` is renamed `prefDecodedValue`: it reads a stored value through the leaf's `encoding`, with no fallback to the default.
  
  ```ts
  // before
  const shown = prefShownValue(leaf, stored);
  // after
  const shown = prefDecodedValue(leaf, stored);
  ```
  
  <!-- entry: breaking api -->
- d01d5a2: `prefAsBox` is renamed `prefDrawsAsBox`, since it is a predicate.
  
  ```ts
  // before
  if (prefAsBox(group.as)) drawBox(group);
  // after
  if (prefDrawsAsBox(group.as)) drawBox(group);
  ```
  
  <!-- entry: breaking api -->
- 594d4ce: `pairRowsOf` is renamed `prefPairRows`, like every other prefs-schema export.
  
  ```ts
  // before
  const rows = pairRowsOf(leaves);
  // after
  const rows = prefPairRows(leaves);
  ```
  
  <!-- entry: breaking api -->
- e7bee92: `PREF_STATUS` is renamed `ROOT_PREF_STATUS`: it is the status a schema's root sits in.
  
  ```ts
  // before
  let status = PREF_STATUS;
  // after
  let status = ROOT_PREF_STATUS;
  ```
  
  <!-- entry: breaking api -->
- bef9c67: `prefScopeSelectors` is renamed `prefStoredSelectors`: it reads the selectors a stored value is split by, not the ones a pref declares.
  
  ```ts
  // before
  const by = prefScopeSelectors(held);
  // after
  const by = prefStoredSelectors(held);
  ```
  
  <!-- entry: breaking api -->
- 2668893: `prefLeafValue` is renamed `prefValueOrDefault`: it returns the held value, else the leaf's default.
  
  ```ts
  // before
  const shown = prefLeafValue(leaf, held);
  // after
  const shown = prefValueOrDefault(leaf, held);
  ```
  
  <!-- entry: breaking api -->
- 33f8369: A prefs store keeps which leaves are auto: only one whose schema declares `auto`, reading its `auto.value` while auto, never its default.
  
  `store.auto()`, `store.isAuto(path)` and `store.setAuto(path, next)` are new, and `store.reset(path)` puts a leaf back as its schema says: auto where it says `auto.on`, else at its default. A leaf that opts in with no `auto.value` reads `undefined` while auto. `usePrefsState(store).form` binds `auto` to `store.auto()`, `onAutoChange` to `store.setAuto` and the new `onReset` to `store.reset`, so a leaf with nothing stored no longer shows as auto, and a leaf that declares no `auto` offers no Auto toggle. A stored auto mark for a leaf that declares no `auto` reads as nothing stored.
  
  ```ts
  // Before: every unset leaf read as auto in a store-bound form
  const gap = { kind: 'number', name: 'Gap', description: '', default: 4 };
  
  // After: a leaf opts in to be auto at all, and says what it reads while auto
  const gap = { kind: 'number', name: 'Gap', description: '', default: 4, auto: { on: true, value: 8 } };
  store.setAuto('gap', true);
  ```
  
  <!-- entry: rank=10 breaking behavior api -->
- fb0e6cd: `scopedPrefUnit` and `prefLeafInScopes` are renamed `unitScopedPrefUnit` and `prefLeafInUnitScopes`: the scopes they apply are unit scopes.
  
  ```ts
  // before
  const leaf = prefLeafInScopes(field, scopes);
  // after
  const leaf = prefLeafInUnitScopes(field, scopes);
  ```
  
  <!-- entry: breaking api -->
- ca89da9: `usePrefsValues` is renamed `usePrefsState`: it returns the whole store as state, setters included.
  
  ```ts
  // before
  const { form } = usePrefsValues(store);
  // after
  const { form } = usePrefsState(store);
  ```
  
  <!-- entry: breaking api -->
- 728e0da: `writePlan` is renamed `writeResetPlan`.
  
  ```ts
  // before
  writePlan(plan, write);
  // after
  writeResetPlan(plan, write);
  ```
  
  <!-- entry: breaking api -->
- d268d21: The functions that read or write a value at a dotted path drop `Path` from their names, as the kit's `…At` functions do.
  
  prefs-schema's (and prefs') `prefValueAtPath` is `prefValueAt`, and `assignPrefValueAtPath` is `assignPrefValueAt`. labkit's `valueAtPath`, `withValueAtPath` and `schemaNodeAtPath` are `configValueAt`, `withConfigValueAt` and `schemaNodeAt`.
  
  ```ts
  // before
  const v = valueAtPath(config, 'grid.size');
  const next = withValueAtPath(config, 'grid.size', 12);
  // after
  const v = configValueAt(config, 'grid.size');
  const next = withConfigValueAt(config, 'grid.size', 12);
  ```
  
  <!-- entry: breaking api -->

### Minor Changes

- 8b96ffe: `PrefAliasTargets` answers `activeAt(path)`: whether the action at a path of the schema the aliases point into has an `activeIf` that holds.
  
  <!-- entry: api -->
- 33f8369: New helpers say whether a leaf can be auto, what it reads while auto, and what a reset makes of it.
  
  They are `prefCanAuto`, `prefStartsAuto`, `prefAutoValue`, `prefResetOf`, `prefIsAtReset`, `prefResets` and `prefStoredReset`. `prefAutoValue(leaf, computed)` is what the owner computed, else the leaf's `auto.value`, and never its default. `PrefGroup` and `PrefSection` take `resettable`, which gives the group's heading a reset of everything under it.
  
  <!-- entry: api new -->
- b7b87f4: The condition editor names a test read from its group (`from: 'group'`) for the group's pref, and offers the group's prefs to read that way.
  
  `conditionLeaves` takes the group's value path as a fourth argument, and `prefConditionFlow` as a `group` option, to name such a test the same way.
  
  <!-- entry: fix api -->
- 2ab2678: New `@weasel-js/prefs/edit`: the model behind a schema editor, with no React and no DOM.
  
  It edits a schema's tree (`addNode`, `moveNodes`, `renameKey`, `copyNodes`, `aliasNodes`) and a leaf's kind and attributes (`changeKind`, `setAttribute`), prints a schema as source and diffs two (`printSchema`, `diffSchemas`), holds an `AssetSet` of schema, layout, action, and bundle assets with its `assetSetCodec` and drafts, and lays a condition out as rows and as a flow (`prefConditionFlow`). These are the functions `@weasel-js/ui`'s schema editor used to keep to itself; the condition rows' `leafOf` is `conditionLeafOf` here, beside the kind table's `leafOf`.
  
  ```ts
  import { addNode, printSchema } from '@weasel-js/prefs/edit';
  
  const next = addNode(schema, null, 'grid', { kind: 'boolean', name: 'Grid', description: '', default: true });
  console.log(printSchema(next));
  ```
  
  <!-- entry: rank=5 new api -->
- 4c8749c: A condition test can read its path from the group its node is declared in, so a settings group mounts anywhere.
  
  ```ts
  axis: pref.enum('Axis', 'x', ['x', 'y'], { enableIf: { from: 'group', path: 'on' } }), // reads <group>.on
  ```
  
  `applyPrefConditions`, `prefStatusAt`, `checkPrefConditions`, settings menus and labkit's `configFromPrefs` resolve these tests themselves. Code that evaluates a schema's conditions any other way resolves them first with `resolvePrefGroupConditions(schema)`, or `prefConditionInGroup(condition, group)` for one condition; one that reaches a reader unresolved warns. `checkPrefCondition` checks one against `site.group`, which the schema editor's marks and `PrefConditionEditor`'s new `group` prop supply (`conditionGroupAt` finds it).
  
  <!-- entry: api -->
- 1eb7bcb: A `PrefsMigration` is handed `auto`, the leaves marked auto at its version, so a migration that renames a leaf can keep it auto.
  
  ```ts
  const renameGrid: PrefsMigration = (records, auto) => {
    if (records.has('grid.size')) records.set('grid.step', records.get('grid.size'));
    records.delete('grid.size');
    if (auto?.delete('grid.size')) auto.add('grid.step');
  };
  ```
  
  A migration that ignores `auto` leaves every mark where it was, now stamped with the version reached.
  
  <!-- entry: api fix -->
- df2ae04: Every type a `@weasel-js/prefs` signature names can now be imported, from the root or from `@weasel-js/prefs/edit`.
  
  The root adds `PrefFieldsOf`, `PrefLeafRest`, `PrefOverridesLookup`, and `PrefUnitText`; `@weasel-js/prefs/edit` adds `AssetBase`, `AttributeAggregate`, `AttributeSchema`, `ConditionMark`, `Folds`, `NodeOrigins`, `Operator`, `OriginOf`, `PrefAtom`, `RegisteredAction`, and `ValueMove`.
  
  <!-- entry: rank=-1 api -->
- a0ad214: `nestPrefValues` turns values keyed by dotted path, as `PrefsBar` and `BarMenu` take them, into the nested tree `PrefsForm` reads.
  
  It writes every key as the tree's own, so a path through `__proto__` or `constructor` lands in the tree and never on a prototype. It is the inverse of `flattenPrefValues`.
  
  <!-- entry: api -->
- 4a102bd: A number pref takes a `placeholder` and a string pref a `maxLength`, and `PrefsForm` honors both as labkit's `ControlPanel` already did.
  
  A stored string longer than its leaf's `maxLength` reads cut to it. Labkit's `.placeholder()` and `.maxLength()` write these same fields.
  
  <!-- entry: api -->
- c80f586: `PX_UNIT` is the display unit of a number leaf measured in CSS pixels on screen.
  
  Write `unit: PX_UNIT` on a leaf keyed `…Px` (a brush radius, a click's reach) rather than spelling `{ scale: 1, suffix: 'px' }`; the kit's own settings and action params now do.
  
  <!-- entry: api -->
- 5477214: `@weasel-js/prefs` re-exports its schema from `@weasel-js/prefs-schema`, and every import from it works as before
  
  The builders, types and helpers moved to `@weasel-js/prefs-schema` and prefs re-exports each by name, so nothing changes for code importing from `@weasel-js/prefs`. Its root also exports `PresetDescription` now, beside `@weasel-js/prefs/edit`.
  
  <!-- entry: api -->
- 8ff14a0: New `resetPlan` and `readingIsAtReset`: the writes a reset of a leaf or a group makes, read from what a surface shows.
  
  `read(path)` returns a `LeafReading` (`{ value, mixed, each, auto }`, one entry of `each` per target), or `undefined` for a leaf the reset should not reach. A plan leaves out readouts and leaves already at their reset, and writes `AUTO` for a leaf that starts auto only where `auto` is defined. `prefNodeAt` finds the leaf, group, or section at a path. labkit's `auto` sentinel is now this same symbol.
  
  <!-- entry: api new -->
- 764f27d: `usePrefsState` returns `setAuto`, the handler `PrefsForm`'s `onAutoChange` takes: false pins a leaf at the value it reads now, true unpins it.
  
  It is `store.setAuto`, which does nothing to a leaf whose schema declares no `auto`.
  
  ```tsx
  const { values, set, auto, setAuto } = usePrefsState(store);
  <PrefsForm schema={schema} values={values} onChange={set} auto={auto} onAutoChange={setAuto} />
  ```
  
  <!-- entry: api fix -->
- 8ff14a0: New `PrefsSource`: where a params surface reads, writes, and resets its leaves, over a values map, a selection, or a lab config.
  
  A `PrefsSource` (`@weasel-js/prefs`) answers `valueAt(path)`, `write(path, value, { draft })`, `update`, `autoAt`, `setAuto`, `stateAt(path)` (`enableIf`, `showIf`, `activeIf`), and `reset(paths)`. It needs no React, so a DOM host builds one with prefs' `createValuesSource(schema, get, set, options)`, which reads the values through `get` each time, or `createSelectionSource({ leaves, read, write, reset })` over any set of targets, or `createRecordSource` over values keyed by whole dotted paths. `sourceResetPlan`, `sourceIsAtReset`, and `sourceLeafIsAtReset` answer what a reset does over one.
  
  In React, `useValuesSource(schema, values, onChange, options)`, `useSelectionSource(input)`, and labkit's `useLabConfigSource(...)` build one (labkit's plain factory is `createLabConfigSource`), and ui's `<PrefsSource source>` and `usePrefsSource()` hand it down.
  
  <!-- entry: api new -->
- 23c35b1: `usePrefsState` returns `form`, which binds a `PrefsForm` or `PrefsDialog` to the store in one spread: values, Auto, and scoped values.
  
  ```tsx
  const { form } = usePrefsState(store);
  <PrefsForm layout="list" {...form} />
  ```
  
  The type is `PrefsFormBinding`, from `@weasel-js/prefs/react`.
  
  <!-- entry: api -->
- 7e5b389: `PrefValuesOf<typeof group>` types the values a prefs group holds, so options can be typed from the schema that draws them.
  
  ```ts
  const grid = pref.group('Grid', { visible: pref.boolean('Shown', true), pitch: pref.number('Pitch', 8) });
  type GridValues = PrefValuesOf<typeof grid>; // { visible: boolean; pitch: number }
  ```
  
  <!-- entry: rank=10 new api -->
- 2f8f458: An alias row's Reset in a form drawn over another schema puts the aliased setting back, where it did nothing.
  
  A source may name the schema its aliases point into as `PrefsSource.over`; `createValuesSource` sets it from its `over` option, and `sourceResetPlan` and `sourceIsAtReset` find a path there that `schema` lacks.
  
  <!-- entry: fix api -->
- 371b695: `usePrefGroup(store, path)` reads one prefs group as an object of its values, and writes the leaves a patch names.
  
  Its paths are typed by `PrefGroupPath`, and its value by `PrefValuesOf<PrefGroupAt<S, P>>`.
  
  <!-- entry: rank=5 api -->

### Patch Changes

- 56784d5: Comparisons of two lists entry by entry go through registry's `sameList` rather than hand-written loops.
  
  <!-- entry: internal -->
- 4bda721: Own-key lookups go through registry's `getOwn` and `hasOwnKey` rather than hand-written `Object.hasOwn` checks.
  
  <!-- entry: internal -->
- ea5f41b: A split color pref read under weights mixes members written as color names or `rgb()`, `hsl()` and `oklch()` strings, not only hex.
  
  <!-- entry: fix visual -->
- 6227913: A split color blends its members under weights whose total overflows, as a split number does. A custom `PrefBlend` is handed weights scaled so the heaviest is 1.
  
  <!-- entry: fix -->
- 53f5ea0: The bundle editor no longer marks an atom as named twice when bundles loaded together each include it, as it already left a shared bundle.
  
  <!-- entry: fix -->
- 1dfa234: A schema edit carried onto a changed source keeps a key the reader added named `toString` or `__proto__`.
  
  <!-- entry: fix -->
- ae411f0: Writing `undefined` to a split pref clears only the option the write names, or the current one, and leaves every other option's value.
  
  <!-- entry: fix -->
- 6e3d5ef: A write through a store from `usePrefsStore` after it has closed no longer reaches storage or another component's store on the same prefix.
  
  <!-- entry: fix -->
- 0c073ec: A closed prefs store reads back a write made after `close`, as `closed` documents, instead of the values it held when it closed.
  
  <!-- entry: fix -->
- 9e84dfc: Copying, removing, or moving schema nodes with a path named twice acts on that node once; a copy no longer makes two.
  
  <!-- entry: fix -->
- 67b97e4: `prefsCss` keeps the block for two selectors apart from one option whose name reads like both, such as `a&b=c`.
  
  <!-- entry: fix -->
- 0b49560: `prefsCss` writes its root block at the option a store with nothing stored reads: a selector that starts auto at its `auto.value`.
  
  <!-- entry: fix visual -->
- 7d11dc3: `prefsCss` quotes an enum option that is a CSS-wide keyword, such as `inherit`, so the custom property holds the option.
  
  The keywords are `inherit`, `initial`, `unset`, `revert`, `revert-layer` and `default`.
  
  <!-- entry: fix -->
- c43e329: `createDefaultsSource`, and so the Vite plugin's stylesheet, reads a leaf that starts auto at its `auto.value`, as a store does.
  
  <!-- entry: fix -->
- ac347a7: The schema editor's drafts and sent copies go through `@weasel-js/storage`'s `readLocal` and `writeLocal`.
  
  They are kept in `localStorage` or the `draftStorage` given, as before. Text under a draft's key that is not JSON still reads as no draft; a sent copy that is not JSON now reads back as its text rather than `null`.
  
  <!-- entry: rank=-5 behavior -->
- a3bb40a: An asset set's draft undone back to its baseline reopens with its steps to redo, as a single schema's draft does.
  
  <!-- entry: fix -->
- 313dd71: The Bundles tree keeps two bundles apart whose ids differ only in punctuation. Ids like `editing:shapes` and `editing.shapes` each get a group, and each link reaches its own.
  
  <!-- entry: fix -->
- 97d6826: Clearing the last field of an object attribute in the schema editor, such as `frame.edge`, removes the attribute instead of leaving `{}`.
  
  <!-- entry: fix -->
- a5aa92f: Changing a pref's kind keeps exactly the shared attributes the new kind offers. A menu letter carries between kinds that take one, and a kind with no value drops `readout` and `auto`.
  
  <!-- entry: fix -->
- e37086f: A schema editor draft reopens with a plain value whose keys are `$type`, `$num`, `$from`, `$stub` or `$unset` as it was saved.
  
  <!-- entry: fix data -->
- a25a444: Changing a pref that carries its own options to an enum keeps its default when that default is one of those options.
  
  <!-- entry: fix -->
- 2d2a16e: The schema editor shows the attributes of a group whose `as` is a name such as `toString` instead of throwing.
  
  <!-- entry: fix -->
- 87bd085: Under a section root, the schema editor refuses a leaf key inside another leaf's value, such as `grid.size` beside `grid`.
  
  A leaf moved there is numbered instead.
  
  `keyClashes` reports such pairs in a schema made elsewhere.
  
  <!-- entry: fix -->
- c4f9031: Conditions, aliases, and layout pointers follow the prefs inside a section moved into, out of, or between `object` prefs.
  
  <!-- entry: fix -->
- dba7a95: `createFolds` keeps a reader's folded rows through `@weasel-js/storage`'s `readLocal` and `writeLocal`.
  
  <!-- entry: rank=-5 internal -->
- eb8fe62: A stored string longer than its pref's `maxLength` reads cut before an emoji that straddles the limit rather than through the middle of it.
  
  <!-- entry: fix -->
- 7c44ba5: `mergePrefGroups` keeps the selectors its schemas' roots admit, so a merged schema reads and writes under them.
  
  <!-- entry: fix -->
- 607ab80: `prefNodeAt` finds nothing at a nested section's key, as its docs say, so `resetPlans` given one writes nothing rather than paths no leaf has.
  
  <!-- entry: fix -->
- c240900: `orderPrefGroup` returns the group itself where each `actions` leaf the order names already holds that order.
  
  <!-- entry: fix -->
- d5bcd74: Pref paths, schema keys and selector options named like `constructor` or `__proto__` read and write as data, not as `Object.prototype` members.
  
  `createRecordSource` reads such a path as holding nothing, the schema editor's `setAttribute` throws for a missing node at such a key instead of editing `Object`, and `createWeightAxes(…).from` keeps a `__proto__` selector as an entry rather than writing onto `Object.prototype`.
  
  <!-- entry: fix -->
- cd473d6: A store warns of, and does not split by, an enum selector that can be auto with no option as its auto value.
  
  <!-- entry: fix -->
- aadb086: A stored `color` pref that is no color, or a `paint` pref that is no paint, reads as the leaf's default.
  
  <!-- entry: fix data -->
- f9cd1ea: `PrefsStore.reset(path)` warns when no leaf is at or under `path`, as `set` and `setAuto` do for a path the schema lacks.
  
  <!-- entry: fix -->
- 5512513: `unitScopedPrefUnit` keeps its scale exact under a unit scope whose offset is far larger than its factor.
  
  <!-- entry: fix -->
- 2dfa806: Writing one option of a split pref that is auto, or pinning it, keeps every other option at the value it read while auto.
  
  <!-- entry: fix -->
- 4ef636a: A prefs store's `stored()` leaves out a leaf marked auto rather than showing the mark's record as its value. `auto()` names those leaves.
  
  <!-- entry: fix -->
- 00ad78a: A stored split value split by a selector the schema lacks reads as the leaf does with nothing stored, its `defaultScope` included. An `auto.value` split that way reads nothing while auto, never the leaf's `default`.
  
  <!-- entry: fix -->
- a06c164: Prefs' CSS values, a blended theme's lengths and plot mark path data write their numbers with `@weasel-js/geom`'s `trimNumber`.
  
  <!-- entry: rank=-5 internal -->
- Updated dependencies [e973dcd]
- Updated dependencies [851a4d3]
- Updated dependencies [d764d06]
- Updated dependencies [a98ad34]
- Updated dependencies [5f856dc]
- Updated dependencies [2c2ab71]
- Updated dependencies [4fb8cbf]
- Updated dependencies [9249b26]
- Updated dependencies [ec44e4c]
- Updated dependencies [4f264d0]
- Updated dependencies [84028cb]
- Updated dependencies [29d293c]
- Updated dependencies [6cef61c]
- Updated dependencies [fcc5602]
- Updated dependencies [c3da788]
- Updated dependencies [ece64a6]
- Updated dependencies [fcc5602]
- Updated dependencies [bfc26b4]
- Updated dependencies [935346c]
- Updated dependencies [0046729]
- Updated dependencies [fcc5602]
- Updated dependencies [ece64a6]
- Updated dependencies [ece64a6]
- Updated dependencies [b6863aa]
- Updated dependencies [36dac61]
- Updated dependencies [27eb7f9]
- Updated dependencies [754e0c6]
- Updated dependencies [aedb49f]
- Updated dependencies [daba59f]
- Updated dependencies [7a053e0]
- Updated dependencies [acb38fe]
- Updated dependencies [644baad]
- Updated dependencies [cbd9a26]
- Updated dependencies [8257aa7]
- Updated dependencies [8c2d558]
- Updated dependencies [af85c85]
- Updated dependencies [6a9cd12]
- Updated dependencies [af85c85]
- Updated dependencies [5d79d0e]
- Updated dependencies [43e65cf]
- Updated dependencies [e280844]
- Updated dependencies [f889447]
- Updated dependencies [b9a8c62]
- Updated dependencies [a3caa9d]
- Updated dependencies [1dc92ce]
- Updated dependencies [ced5841]
- Updated dependencies [4949266]
- Updated dependencies [9f6da2d]
- Updated dependencies [15a78d8]
- Updated dependencies [f54c013]
- Updated dependencies [2acda2a]
- Updated dependencies [1cc8fea]
- Updated dependencies [3588b89]
- Updated dependencies [9a45d4a]
- Updated dependencies [4f2ce5c]
- Updated dependencies [4e54b4e]
- Updated dependencies [2b26641]
- Updated dependencies [eec8a23]
- Updated dependencies [353033f]
- Updated dependencies [27f0928]
- Updated dependencies [a3f0833]
- Updated dependencies [0157b15]
- Updated dependencies [4f35254]
- Updated dependencies [0118cd0]
- Updated dependencies [70213a5]
- Updated dependencies [4f9848f]
- Updated dependencies [4c0bb1b]
- Updated dependencies [4dff167]
- Updated dependencies [514f6ad]
- Updated dependencies [d455bd2]
- Updated dependencies [11c9e5f]
- Updated dependencies [241446a]
- Updated dependencies [81cc3f8]
- Updated dependencies [e0a11e4]
- Updated dependencies [e280844]
- Updated dependencies [a7fd87a]
- Updated dependencies [0f0c7e5]
- Updated dependencies [ce89e1f]
- Updated dependencies [c4d419b]
- Updated dependencies [da7dd2e]
- Updated dependencies [8cbcaf4]
- Updated dependencies [2d649c0]
- Updated dependencies [5b84935]
- Updated dependencies [02900a7]
- Updated dependencies [308226e]
- Updated dependencies [b2ecf6d]
- Updated dependencies [8af195e]
- Updated dependencies [7459739]
- Updated dependencies [5d43ec9]
- Updated dependencies [57af464]
- Updated dependencies [2338cee]
- Updated dependencies [8887919]
- Updated dependencies [6943c8d]
- Updated dependencies [0e9f123]
- Updated dependencies [9078cfb]
- Updated dependencies [ff75b6f]
- Updated dependencies [19d0c9f]
- Updated dependencies [a2f20ae]
- Updated dependencies [fb96bd3]
- Updated dependencies [17fa534]
- Updated dependencies [53a1558]
- Updated dependencies [f50c6d9]
- Updated dependencies [4fb24ca]
- Updated dependencies [aedb49f]
- Updated dependencies [10dd276]
- Updated dependencies [c6f965b]
- Updated dependencies [3c7a87a]
- Updated dependencies [1b00300]
- Updated dependencies [22b57c5]
- Updated dependencies [2e12700]
- Updated dependencies [8882b53]
- Updated dependencies [174d6ef]
- Updated dependencies [a20fc8c]
- Updated dependencies [a2fbf00]
- Updated dependencies [67f9f88]
- Updated dependencies [bc67ae1]
- Updated dependencies [e6871f1]
- Updated dependencies [1ad4f25]
- Updated dependencies [1eb7552]
- Updated dependencies [7863d23]
- Updated dependencies [de8f61d]
- Updated dependencies [ec23b4e]
- Updated dependencies [de8f61d]
- Updated dependencies [28b5165]
- Updated dependencies [ff70ebe]
- Updated dependencies [0f43324]
- Updated dependencies [f4b9a4a]
- Updated dependencies [85f85ba]
- Updated dependencies [adb1290]
- Updated dependencies [b98bad7]
- Updated dependencies [0d377ec]
- Updated dependencies [435c248]
- Updated dependencies [e1e7241]
- Updated dependencies [977164c]
- Updated dependencies [9aed377]
- Updated dependencies [c491f93]
- Updated dependencies [aadb086]
- Updated dependencies [09f0c86]
- Updated dependencies [d11dc30]
- Updated dependencies [5ad7bc0]
- Updated dependencies [481218b]
- Updated dependencies [f8172cf]
- Updated dependencies [e5395a6]
- Updated dependencies [cd7ffdb]
- Updated dependencies [8ced7e2]
- Updated dependencies [5ed6215]
- Updated dependencies [9cacd4b]
- Updated dependencies [f95e342]
- Updated dependencies [d6ba47e]
- Updated dependencies [fcc5602]
- Updated dependencies [fcc5602]
- Updated dependencies [880cbbf]
- Updated dependencies [2932eb2]
- Updated dependencies [c1a3072]
- Updated dependencies [968362b]
- Updated dependencies [f4bfab5]
- Updated dependencies [e6c888e]
- Updated dependencies [fcc5602]
- Updated dependencies [3cf6a17]
- Updated dependencies [56089ae]
- Updated dependencies [f544aeb]
- Updated dependencies [4f2d1e0]
- Updated dependencies [ece64a6]
- Updated dependencies [9c507b5]
- Updated dependencies [9c507b5]
- Updated dependencies [ff4504e]
- Updated dependencies [58f9d2e]
- Updated dependencies [c67bcfa]
- Updated dependencies [f04bbbc]
- Updated dependencies [0f60e3d]
- Updated dependencies [5124d5a]
- Updated dependencies [0f60e3d]
- Updated dependencies [3207a40]
- Updated dependencies [e49aa18]
- Updated dependencies [70076bc]
- Updated dependencies [4b3a525]
- Updated dependencies [15e923d]
- Updated dependencies [4c8749c]
- Updated dependencies [9057ecb]
- Updated dependencies [2823dca]
- Updated dependencies [1c43dbf]
- Updated dependencies [a3b1735]
- Updated dependencies [d01d5a2]
- Updated dependencies [bcc5c05]
- Updated dependencies [e11a52e]
- Updated dependencies [3744131]
- Updated dependencies [5477214]
- Updated dependencies [594d4ce]
- Updated dependencies [7e5b389]
- Updated dependencies [2e7bd80]
- Updated dependencies [6c3e486]
- Updated dependencies [e7bee92]
- Updated dependencies [7affd45]
- Updated dependencies [bef9c67]
- Updated dependencies [470d4be]
- Updated dependencies [2668893]
- Updated dependencies [7e5b389]
- Updated dependencies [6a9a3dc]
- Updated dependencies [e06225e]
- Updated dependencies [e0f4c91]
- Updated dependencies [38095a2]
- Updated dependencies [d30164d]
- Updated dependencies [04d5af6]
- Updated dependencies [04d5af6]
- Updated dependencies [c98a300]
- Updated dependencies [04d5af6]
- Updated dependencies [e7d580b]
- Updated dependencies [cdbafb8]
- Updated dependencies [3005391]
- Updated dependencies [3311dde]
- Updated dependencies [5b11625]
- Updated dependencies [afbe8c3]
- Updated dependencies [8bf1866]
- Updated dependencies [c4bcb94]
- Updated dependencies [7785bd5]
- Updated dependencies [e59f1ae]
- Updated dependencies [a8ff1e9]
- Updated dependencies [25e8f76]
- Updated dependencies [3a07b60]
- Updated dependencies [b73c8ef]
- Updated dependencies [6274bad]
- Updated dependencies [758459f]
- Updated dependencies [70213a5]
- Updated dependencies [b72cf48]
- Updated dependencies [b34f11e]
- Updated dependencies [04d5af6]
- Updated dependencies [5603bef]
- Updated dependencies [126d17f]
- Updated dependencies [d17a134]
- Updated dependencies [4e68cf0]
- Updated dependencies [ff5f066]
- Updated dependencies [f164d0e]
- Updated dependencies [586ca31]
- Updated dependencies [ba8d3a0]
- Updated dependencies [857e1fc]
- Updated dependencies [3f553ff]
- Updated dependencies [5d75785]
- Updated dependencies [4d31cf0]
- Updated dependencies [af132bc]
- Updated dependencies [2d57c94]
- Updated dependencies [f004638]
- Updated dependencies [3c27e36]
- Updated dependencies [3c27e36]
- Updated dependencies [ce5d609]
- Updated dependencies [70e7b25]
- Updated dependencies [b9006ad]
- Updated dependencies [b9006ad]
- Updated dependencies [dd5a540]
- Updated dependencies [4a4d7c9]
- Updated dependencies [73f549e]
- Updated dependencies [73f549e]
- Updated dependencies [a13982c]
- Updated dependencies [52ee422]
- Updated dependencies [73f549e]
- Updated dependencies [4bcea5f]
- Updated dependencies [6fcc7aa]
- Updated dependencies [eb8fe62]
- Updated dependencies [e9613f8]
- Updated dependencies [f004638]
- Updated dependencies [52d9d64]
- Updated dependencies [e3c67e9]
- Updated dependencies [34090f0]
- Updated dependencies [03b9392]
- Updated dependencies [15e923d]
- Updated dependencies [5962dc2]
- Updated dependencies [5dae54d]
- Updated dependencies [0208a3b]
- Updated dependencies [bb7bb11]
- Updated dependencies [ee1de44]
- Updated dependencies [56fda8d]
- Updated dependencies [f88d616]
- Updated dependencies [1c2c1ac]
- Updated dependencies [1d8e163]
- Updated dependencies [e08d172]
- Updated dependencies [429e80c]
- Updated dependencies [002ff57]
- Updated dependencies [7a7ea82]
- Updated dependencies [9521334]
- Updated dependencies [12cfcfc]
- Updated dependencies [415e5b8]
- Updated dependencies [e68cb62]
- Updated dependencies [0ee2887]
- Updated dependencies [767af8a]
- Updated dependencies [fb702eb]
- Updated dependencies [c11f37e]
- Updated dependencies [e39dbc5]
- Updated dependencies [98d2f9a]
- Updated dependencies [3381131]
- Updated dependencies [4f23eaa]
- Updated dependencies [817c4a0]
- Updated dependencies [f822a1d]
- Updated dependencies [99ca079]
- Updated dependencies [55af93c]
- Updated dependencies [c438a4b]
- Updated dependencies [da233f8]
- Updated dependencies [e45a847]
- Updated dependencies [ea981c8]
- Updated dependencies [3637a58]
- Updated dependencies [cf2ad81]
- Updated dependencies [60c082d]
- Updated dependencies [1e58c0d]
- Updated dependencies [d3b462a]
- Updated dependencies [49f1f5b]
- Updated dependencies [1f05956]
- Updated dependencies [a8efdf5]
- Updated dependencies [774e9cc]
- Updated dependencies [e841e68]
- Updated dependencies [18f7289]
- Updated dependencies [a5caeed]
- Updated dependencies [34b8a3f]
- Updated dependencies [e3148d0]
- Updated dependencies [8fb09ad]
- Updated dependencies [ba7e062]
- Updated dependencies [0d977b8]
- Updated dependencies [371b695]
- Updated dependencies [d268d21]
- Updated dependencies [5dd240d]
- Updated dependencies [8b01b26]
- Updated dependencies [2c0f2fe]
- Updated dependencies [12816b7]
- Updated dependencies [6803209]
- Updated dependencies [f857c86]
- Updated dependencies [aec0cec]
- Updated dependencies [5202a9f]
- Updated dependencies [174070d]
  - @weasel-js/geom@2.0.0
  - @weasel-js/quantity@2.0.0
  - @weasel-js/registry@2.0.0
  - @weasel-js/paint@2.0.0
  - @weasel-js/react@2.0.0
  - @weasel-js/history@2.0.0
  - @weasel-js/prefs-schema@2.0.0
  - @weasel-js/storage@2.0.0

## 1.19.1

### Patch Changes

- 8ada2a6: Two `KitSettingsFromPrefs css` bridges on one root share its selector attributes: unmounting one leaves the other's in place.
  
  <!-- entry: fix -->
- Updated dependencies [c9adfef]
- Updated dependencies [97be45c]
- Updated dependencies [1691dec]
- Updated dependencies [b62d643]
- Updated dependencies [039b7ad]
- Updated dependencies [d254251]
- Updated dependencies [87bf0a8]
- Updated dependencies [8725f6c]
- Updated dependencies [d5593b2]
- Updated dependencies [1da0762]
- Updated dependencies [9f44d6d]
- Updated dependencies [d11f1df]
- Updated dependencies [8562ebe]
- Updated dependencies [f265a52]
- Updated dependencies [a4ef496]
- Updated dependencies [2c3416d]
  - @weasel-js/quantity@1.19.1
  - @weasel-js/paint@1.19.1
  - @weasel-js/react@1.19.1
  - @weasel-js/registry@1.19.1
  - @weasel-js/storage@1.19.1
  - @weasel-js/icons@1.19.1

## 1.19.0

### Patch Changes

- 65ee9a0: Layouts, bounds, legends and reports over hundreds of thousands of items no longer overflow the call stack. This covers, for example, a grid of a million nodes, a million pages, a polyline of a million points and a store of a million prefs records.
  
  <!-- entry: fix -->
- 60b297c: A split pref read under `weights` with an infinite weight reads as the member that weight names instead of `NaN`.
  
  Several infinite weights, including nested weights whose product overflows, share the blend equally and the finite ones drop out. Where nested weights underflow to nothing, every member shares the blend equally.
  
  <!-- entry: fix -->
- 3065fad: A number split by a selector and read under `weights` blends to a value between its members whatever the weights.
  
  Equal members read as themselves.
  
  <!-- entry: rank=-5 fix -->
- 8c7c11a: `prefDisplayBounds` moves a lone `min` or `max` to the other end under a unit whose conversion decreases, as it does for a leaf with both bounds.
  
  <!-- entry: fix -->
- 8e09cb6: `mergePrefGroups` merges a leaf or group at an inherited key such as `constructor` or `toString` instead of throwing.
  
  <!-- entry: rank=-5 fix -->
- c6d9ee5: A schema child keyed `__proto__` survives `orderPrefGroup`, `visiblePrefSubtree`, `filterPrefSubtree` and `applyPrefConditions`. A selector at such a path keeps its option.
  
  <!-- entry: rank=-5 fix -->
- 56a58c9: A store from `usePrefsStore` resolves `close()` with whether every queued write reached storage, as `flush()` does, rather than with `undefined`.
  
  <!-- entry: fix -->
- b1309b2: `prefShownReader` shows a `union` field through the variant the value holds, so one variant's `encoding` is no longer applied to another's field.
  
  <!-- entry: fix -->
- 45373d0: `checkPrefConditions` checks a condition on a `union` field against every variant, not only the first.
  
  `{ path: 'fill.d', is: '' }` no longer warns that it never holds when only another variant's `d` is a string.
  
  <!-- entry: fix -->
- 3e4a895: A step of `1e-7` shows seven decimal places, and a value typed at a unit scale written as `1e-7` is stored without binary dust.
  
  `@weasel-js/quantity` exports `decimalPlaces`, which counts the decimal places a number is written with, exponent form included, capped at 20. Stepping, a slider step's readout, the token scale slider and a linear pref unit all count with it.
  
  <!-- entry: fix api -->
- 30c0e8e: A unit catalog in `@weasel-js/quantity` gives each unit one symbol, compact form and spoken name, read wherever units are shown or typed.
  
  Each entry has a unit's canonical name, its symbol, a compact form for tight spaces (`″` for `in`, `′` for `ft`), the aliases that read as it, its spoken names or `Intl` unit, its CSS unit, and whether its glyph attaches to the number (`°`, `′`, `″`, `%`). `catalogUnit`, `unitSymbol`, `unitSpellings`, `withUnit` and `speakUnit` read it, and `registerUnit` adds or replaces a unit and returns a function that takes it back out. The `unit` display, the bytes and duration displays' speech, `parseNumber`'s alternate spellings and `prefsCss`'s CSS units all read the catalog, in place of the tables each kept.
  
  `UnitDisplay` and a prefs unit take `compact: true` for a unit's compact form, and a unit is written as the catalog writes it, so `unit('deg')` and a prefs unit with `suffix: 'deg'` show `°`.
  
  In `@weasel-js/ui`, a field's or readout's unit whose glyph attaches stays on the value's line in every layout, including an inline slider row that hangs word units below its readout, and is out of flow, so the field is the same size with it as without. The catalog decides which units attach: a property field's string `unit`, a menu number row's `suffix` and a read-only readout all ask it. `QuantityText`'s `unit` takes `compact` and marks an attaching unit `data-attach`.
  
  Breaking: `unit('"')` now shows `12″` and `unit("'")` shows `1′`, the compact forms those marks are aliases of, and a unit named by an alias shows its symbol (`deg` shows `°`). A degree passed as `<sup>°</sup>` still draws as given but no longer attaches; pass the string `'°'`. `ResolvedPrefUnit.suffix` is the text a field shows, the catalog's form of the one written. Typed text reads every spelling the catalog knows for a unit a table accepts, so a field accepting `deg` also reads `°`. A scale indicator's label is spoken through the catalog, `Scale: 10 feet`.
  
  <!-- entry: rank=20 breaking api new visual pick -->
- Updated dependencies [0e15698]
- Updated dependencies [3b3289a]
- Updated dependencies [fbb67d5]
- Updated dependencies [68383ed]
- Updated dependencies [337b676]
- Updated dependencies [c2465cd]
- Updated dependencies [458e1c2]
- Updated dependencies [dd13518]
- Updated dependencies [b62813d]
- Updated dependencies [f68d93b]
- Updated dependencies [6321d2a]
- Updated dependencies [b1309b2]
- Updated dependencies [041dbf7]
- Updated dependencies [4ff3e3e]
- Updated dependencies [785627a]
- Updated dependencies [3e4a895]
- Updated dependencies [302c660]
- Updated dependencies [0cff741]
- Updated dependencies [b1309b2]
- Updated dependencies [0f8e7cc]
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [2bf3397]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
- Updated dependencies [851bf17]
- Updated dependencies [851bf17]
- Updated dependencies [623c0b8]
- Updated dependencies [2c6c317]
- Updated dependencies [7ca4c3d]
- Updated dependencies [30c0e8e]
- Updated dependencies [592f6ec]
  - @weasel-js/quantity@1.19.0
  - @weasel-js/icons@1.19.0
  - @weasel-js/paint@1.19.0
  - @weasel-js/storage@1.19.0
  - @weasel-js/registry@1.19.0
  - @weasel-js/react@1.19.0

## 1.18.2

### Patch Changes

- 115c920: Fixes to labkit's chrome, trial keys and settings rail, and to how action and enum prefs report their state.
  
  - A trial may suppress `eyedropper`, `picked-color` and `snapshot-load` before they appear. Before, naming one in `suppress` threw until a lens mounted or a snapshot was saved, as naming a typo does.
  - `sectionTree` answers an action's `activeIf` against the config, as it does `showIf` and `enableIf`. Before, the rail form read the condition against its renested values, where nothing is at the config's paths, so the button never latched.
  - A lab header item's command carries the item's icon, shortcut text and danger grade, so a palette or menu running it shows what the header button does.
  - A held Mod+S saves one snapshot rather than one per key repeat.
  - The palette keeps a group's tools together where the group first appears, as every other region does. Before, it drew them in declaration order, and `TrialTool.group` said ungrouped tools sorted last, which nothing did.
  - `applyPrefConditions` names an action in `active` only where its `activeIf` was answered. Before, an action in a list's item whose condition reads the entry was reported active at `rows.*`, and `applyPrefEntryConditions` reported an entry's action active whenever its condition read anything but the entry.
  - A menu drawn from an enum pref carries each option's icon, description and disabled reason onto its row, as forms and selects already do; forge's Globals menu shows them.
- Updated dependencies [0e5661d]
- Updated dependencies [30dd2dc]
- Updated dependencies [b188aea]
- Updated dependencies [07205dd]
  - @weasel-js/react@1.18.2
  - @weasel-js/paint@1.18.2
  - @weasel-js/registry@1.18.2
  - @weasel-js/icons@1.18.2
  - @weasel-js/storage@1.18.2
  - @weasel-js/quantity@1.18.2

## 1.18.1

### Patch Changes

- 112f6bb: Name an icon with a mark in data
  
  - Every field that names an icon takes an `IconSpec`: a ref, or `{ name, mark }` for a subject with a mark set in its corner. That covers an action's and a variant's `icon`, a tool's `presentation.icon`, `useCommand`'s, a pref's and a group's, labkit's chrome, tool and builder items, path-tools' stroke-click tools, diagram stencils and types, forge globals, paint kinds, `SelectionPanel` sections, and `Bar`'s and `ActionBar`'s icons. A bare ref still works everywhere one did.
  - `@weasel-js/icons` exports `IconSpec`, `iconParts`, `iconSpecRefs` and `toIconSpec`, which reads a spec from JSON. It also exports `markLayers`, `ICON_SLOTS`, `ICON_FRAME` and `ICON_STROKE`, the slot geometry `<Icon mark>` used to keep in ui, so every renderer sets a mark the same way.
  - `<Icon name>` takes a spec, and its `mark` prop replaces the spec's. `resolveIcon` and `actionIcon` draw a spec's mark.
  - hud's canvas menus draw a row's mark, cutting the subject around it. `iconCommands(icons, spec, at)` is exported beside `glyphCommands`.
  - The schema editor's icon field picks a mark from the `Marks` group and writes `{ name, mark }`.
  - Code reading a field that was `IconRef` and is now `IconSpec` should read its refs with `iconSpecRefs` rather than assume a string. The devtools snapshot writes a spec's icon as `name + mark`.
  - The boolean crop glyph no longer uses a `clipPath`, which hud's canvas renderer skipped, drawing the whole disc filled.
- 4dd9285: Grade, shortcut and pressed state for an action pref, and why a pref is disabled
  
  - An `action` leaf takes `grade` (`'danger'` draws a "Clear all" red), `shortcut`, the keys shown in its tooltip and a menu's row, and `activeIf`, a condition that draws its button pressed while it holds. All three are plain data, so they survive JSON. On a leaf naming a registered `action`, `shortcut` and `activeIf` are drawn over the action's own; on a leaf with only `run`, they are all it has. `PrefGrade` is exported, the same values as theme's `Grade`.
  - `applyPrefConditions` and `applyPrefEntryConditions` return `active`, the paths of the actions whose `activeIf` holds, and `checkPrefConditions` checks `activeIf` as it checks `showIf` and `enableIf`. `PREF_CONDITION_FIELDS` names all three, and `PrefConditionField` includes `activeIf`.
  - Every leaf takes `disabledReason`, read in its tooltip while it is disabled. An enum option, now exported as `PrefEnumOption`, takes `description`, its tooltip, and `disabledReason`.
  - `PrefsForm`, `Bar`, `SelectionPanel` and labkit's `ControlPanel` draw all of these. A row's help reads the reason after the description, an action's button and a segment keep a tooltip saying it, and a selection panel latches an action only while its `activeIf` holds for every node selected. `useLeafAction` takes the latch as a fourth argument and returns `grade`.
  - `PropertyRow` and `PropertyHelp` take `disabledReason`, as does every field (`PropertyField`, `PropertyControl`); a `PropertyOption` takes `description` and `disabledReason`, which a toggle's segments draw and a select, radio group or menu does not yet. `BarActionButton` takes `grade`.
  - The schema editor offers Why disabled on every leaf with a control, Grade, Shortcut and Pressed if on an action, and Description, Disabled and Why disabled on each enum option.
- Updated dependencies [21957cc]
- Updated dependencies [112f6bb]
  - @weasel-js/storage@1.18.1
  - @weasel-js/icons@1.18.1
  - @weasel-js/paint@1.18.1
  - @weasel-js/quantity@1.18.1
  - @weasel-js/react@1.18.1
  - @weasel-js/registry@1.18.1

## 1.18.0

### Patch Changes

- 26e836e: Fix rounding, token-reading and CSS-escaping bugs in prefs, quantity and theme
  
  - A linear pref unit's shown value now rounds a negative half away from zero, as its formatted text does: `-0.125` at two places shows `−0.13` in the field, not `−0.12`.
  - The `ordinal`, `roman` and `integer` kinds round a half away from zero, as the numbers they show do: `-2.5` reads `−3rd`, not `−2nd`, and typing `-2.5` into an integer field reads as −3.
  - `tokenPx` reads a bare `0` as 0px instead of throwing, so a theme that sets a radius to `0` no longer breaks the HUD's panel drawing.
  - `prefsCss` escapes line breaks in the strings it writes; a string pref that held one used to lose its declaration.
- 9b7e5c7: Fixes from an audit of theme, routing and prefs:
  
  - An axis value, a token name or a tool id that matches the name of an `Object.prototype` member (`toString`, `constructor`) now reads as any other name. Before, `fullSelection` kept `{ mode: 'toString' }` and resolved a function as a token's value, `resolveTokens` resolved a token named `constructor` to `Object`, `flattenTokens` reported such a token as a duplicate, `loadDTCG` filled a mode that lacked the token with `Object`, and `useTools` answered `has('toString')` with true.
  - `useColorModePreference` reads the stored choice again when `storageKey` changes. It kept the old key's choice and wrote it into the new slot on the next `setPreference`.
  - `prefsCss` leaves out a held color whose text could end its declaration or its rule, as it already escapes a string or an enum option.
  - `applyTheme` leaves out a token whose value has `;`, `{` or `}` outside a quoted string, or a quote left open, and warns once in development, as `ThemeProvider` warns of an unknown axis value. Such a value, which a theme built from prefs can carry from storage, ended the theme's rule and wrote rules of its own.
  - `prefDisplayBounds` converts a number leaf's `step` into its display unit without rounding, then rounds it up to the smallest step the unit's `precision` shows, so a step always changes the shown value and never moves less than declared: 1 mm shown in whole centimeters steps by 1 cm. A step that rounded to nothing fell back to the declared step in stored units. `resolvePrefUnit` gives `toDisplayExact`, the unrounded conversion, and `precision`.
- bdb314c: A pref leaf can carry `meta`, the consumer's own data, which the kit keeps and never reads: no settings search matches it. labkit fields set it with `.meta({...})`, merged across calls; it rides the resolved leaf and survives a round trip through prefs.
- Updated dependencies [fe6a382]
- Updated dependencies [bf2e0c3]
- Updated dependencies [26e836e]
- Updated dependencies [b4163e6]
- Updated dependencies [b93c1dd]
- Updated dependencies [d83476e]
- Updated dependencies [1e0adbb]
- Updated dependencies [2455bb4]
- Updated dependencies [e3ce292]
  - @weasel-js/paint@1.18.0
  - @weasel-js/storage@1.18.0
  - @weasel-js/quantity@1.18.0
  - @weasel-js/react@1.18.0
  - @weasel-js/icons@1.18.0
  - @weasel-js/registry@1.18.0

## 1.17.3

### Patch Changes

- @weasel-js/icons@1.17.3
  - @weasel-js/paint@1.17.3
  - @weasel-js/quantity@1.17.3
  - @weasel-js/react@1.17.3
  - @weasel-js/registry@1.17.3
  - @weasel-js/storage@1.17.3

## 1.17.2

### Patch Changes

- 47679f8: `blendTheme` and the prefs color blend mix alpha premultiplied, as CSS `color-mix()` does, so a blend toward `transparent` keeps the other color's hue rather than drifting toward black. Both now go through paint's new `mixRgba` (two colors, in any `ColorInterpolationSpace`) and `mixRgbaWeighted` (any number, by weight). `mixOklab` is `mixRgba` in OKLab and now computes in float precision rather than through 8-bit channels.
- 9298f90: `RecordCache.close()` resolves whether every queued write landed, as `flush()` does, since a write still queued once it closes is never sent. `PrefsStore.close()` and the lab store's `close()` pass that answer on. All three used to resolve `void`, so a failed final write went unreported. This breaks code that implements one of these interfaces with a `close` resolving `void`: it now has to resolve a boolean.
- 5f8b357: `prefLeafInScopes` gives a length the unit of its scopes inside a list's, a map's and a union's entries too, where it used to reach only an object leaf's children.
- Updated dependencies [32e0dd5]
- Updated dependencies [5cb2995]
- Updated dependencies [548a4a0]
- Updated dependencies [959ac9b]
- Updated dependencies [4c781a6]
- Updated dependencies [019b877]
- Updated dependencies [47679f8]
- Updated dependencies [9298f90]
- Updated dependencies [a08b740]
- Updated dependencies [29f15a5]
- Updated dependencies [ab39d07]
- Updated dependencies [33c0cbd]
- Updated dependencies [eb24621]
- Updated dependencies [df46c46]
- Updated dependencies [ffacbd8]
  - @weasel-js/paint@1.17.2
  - @weasel-js/quantity@1.17.2
  - @weasel-js/storage@1.17.2
  - @weasel-js/react@1.17.2
  - @weasel-js/icons@1.17.2
  - @weasel-js/registry@1.17.2

## 1.17.1

### Patch Changes

- @weasel-js/icons@1.17.1
  - @weasel-js/paint@1.17.1
  - @weasel-js/quantity@1.17.1
  - @weasel-js/react@1.17.1
  - @weasel-js/registry@1.17.1
  - @weasel-js/storage@1.17.1

## 1.17.0

### Patch Changes

- 3a4cc62: A number pref's slider can space its track other than linearly. A number leaf takes `scale`: `'linear'`, `'log'`, `'sqrt'`, or a `{ to, from }` pair, and labkit's `NumberNode` takes `.scale(...)`, so a segment count where 1–100 matters most, `f.number(16).range(1, 1000).step(1).scale('log')`, gives 1–10, 10–100 and 100–1000 a third of the track each. Only the track changes: the typed value, `step`, `stops`, the arrow keys and the stored value stay in the value's own units. Under a `unit` the scale spaces the shown values. A `'log'` track over a range not above zero warns once in development and is drawn linear. `PropertyField`'s number field takes `scale` as a `ContinuousScaleFactory`, as `Slider` does, and draws its stops where the scale puts them; ui's `prefNumberScale` turns a leaf's `scale`, or a factory, into one, naming its caller in the log warning when given a label. `BandEditor` resolves its `scale` through it too, so its log default now also falls back to linear, rather than throwing, while an edge drag stretches the axis down to zero or below. `PrefSchemaEditor` offers linear, log and sqrt for a number leaf. Additive.
  
  `@weasel-js/plot/scales` adds `powScale({ domain, range, exponent })`, which keeps a negative value's sign so a square-root scale (`exponent: 0.5`) takes zero and negatives, and `warpScale({ domain, range, to, from })`, a scale linear in `to(value)`. Both tick and label in value units, as `linearScale` does. `Scale.kind` and `ContinuousScale.kind` gain `'pow'` and `'warp'`.
- Updated dependencies [f7dc7c8]
- Updated dependencies [52fd33e]
- Updated dependencies [4264abb]
- Updated dependencies [d53bb96]
  - @weasel-js/react@1.17.0
  - @weasel-js/paint@1.17.0
  - @weasel-js/quantity@1.17.0
  - @weasel-js/icons@1.17.0
  - @weasel-js/registry@1.17.0
  - @weasel-js/storage@1.17.0

## 1.16.2

### Patch Changes

- @weasel-js/icons@1.16.2
  - @weasel-js/paint@1.16.2
  - @weasel-js/quantity@1.16.2
  - @weasel-js/react@1.16.2
  - @weasel-js/registry@1.16.2
  - @weasel-js/storage@1.16.2

## 1.16.1

### Patch Changes

- Fixes to the stroke trim that shipped in 1.16.0, and a Trim row for the stroke panel.
  
  - Text ignores its stroke's trim everywhere now, not just on canvas. A trimmed text stroke used to cut each glyph's outline in PDF export (whenever a glyph was drawn as an outline), in Outline Stroke, and in Create Outlines. `resolveRuns` (text) now drops the trim, and `ResolvedRun.stroke` is typed without one.
  - SVG export writes a path stroke aligned `inner` or `outer` as its filled outline, the way it writes a variable-width stroke. It used to write it centered with a warning, so the SVG disagreed with the canvas and the PDF, trimmed or not. The path keeps its stroke at `stroke-width="0"` and records the alignment as `wzl:stroke-align`, which import reads back. Text strokes still warn.
  - An `object` pref leaf's dotted field (`'nib.angle'`) now reads and writes a field of a field. It used to read nothing and write a flat key named `nib.angle`, so the stroke panel's nib Angle and Thinnest rows never took effect. `prefObjectField` (prefs) reads one, and `prefObjectWithField` sets one, making the objects on the way and dropping one a cleared field leaves empty.
  - The stroke properties schema (core's default node properties, which draw's sidebar shows) has a Trim row after the markers: Start and End as fractions, and Pace once either is set. An edge held as a length, anchor or subpath disables its slider rather than being rewritten.
- 017246d: A number leaf whose unit sets `precision` now shows that many places, trailing zeros included: `1.5` at `precision: 2` reads `1.50`, so a column of them lines up. The field, a menu's number row and the unit's `format` (tooltips, dialog summaries) all agree, and a leaf's own `display` still wins. Typing is left alone until the field commits. This changes what existing precision units show: the default node properties' rotation, at `precision: 1`, reads `45.0°` where it read `45°`. `resolvePrefUnit` returns the unit's `display`, and `formatUnit` takes a `pad` option (its options are exported as `FormatUnitOptions`).
- Updated dependencies [25a1ff7]
- Updated dependencies [017246d]
  - @weasel-js/registry@1.16.1
  - @weasel-js/quantity@1.16.1
  - @weasel-js/icons@1.16.1
  - @weasel-js/react@1.16.1
  - @weasel-js/storage@1.16.1
  - @weasel-js/paint@1.16.1

## 1.16.0

### Minor Changes

- 22451fd: Scoped prefs: a pref declares the settings its value is kept separately for, and the store resolves which
  value applies. A **pref** is the declaration; a **value** is one stored value of a pref under a scope, the
  shared `$else` one included; the **current value** is what a read returns under the current selection.
  
  **Breaking: `PrefScope` changed meaning.** It used to be `{ shown, enabled }`, a node's status under its
  parents' conditions. That is now `PrefStatus`, and `PrefScope` is the stored shape of a scoped value,
  `{ $by, $in, $else }`, which was `PrefLocus`. The status family is renamed with no aliases: `PREF_SCOPE` is
  `PREF_STATUS`, `prefScopeAt` is `prefStatusAt`, `prefScopeIn` is `prefStatusIn`, `prefScopeUnder` is
  `prefStatusUnder`, `PrefScopeAtOptions` is `PrefStatusAtOptions`, and `PrefOwner`'s `scope` field is
  `status`. The locus family is renamed the same way: `isPrefLocus` is `isPrefScope`, `prefLocusMember` is
  `prefScopeValue`, `prefLocusSelectors` is `prefScopeSelectors`, a store's `locus(path)` and `loci()` are
  `scope(path)` and `scopes()`, `usePrefsValues`' `loci` and `PrefsForm`'s `loci` prop are `scopes`, and
  `PrefsCssSource.locus` and theme's `ThemePrefsSource.locus` are `scope`, and `themePrefsValues` returns
  `scopes` where it returned `loci`.
  
  **Breaking: `splitBy` is gone, and so is reader-driven splitting.** A pref lists its selectors in
  `scopes: [{ selector, overrides? }]` (`PrefScopeSpec`), outermost first, or with labkit's
  `.per(selector, overrides?)`. Scopes are design-time only (decided 2026-11-01): the store's `split` and
  `join`, `usePrefsValues`' `split` and `join`, and `PrefsForm`'s `onSplit` and `onJoin` with their Split
  and Join buttons are gone. A scoped pref with nothing stored holds one empty scope per selector, so its
  first write keeps the current option's own value, where a `splitBy` pref wrote one value for every
  option until a reader split it.
  
  A stored value whose shape the declaration does not match still reads: a plain value reads as the
  shared value; a value split by a selector the declaration scopes at that level reads as that scope; a
  value split by any other selector reads as it always did. The first write to it rebuilds it in the
  declared shape, with what it reads under the current selection as the shared value, so only the value
  written changes.
  
  **Breaking: `defaultLocus` is `defaultScope`**, read only on a pref that declares scopes.
  
  **Theme token prefs are scoped by what their values differ along.** A token's scopes are the axes its CSS
  differs along anywhere, each open, in axis order; a token that differs along none is one plain value. So
  editing `surface` in dark changes dark only, a control height changes the current density only, and a font
  family changes everywhere. A pin may give `scope: ['mode']` to add an axis its value does not differ along
  yet. A token's default is its CSS folded along those axes, in `defaultScope`. Theme values stored when every
  token was split by every axis read as before under the rule above: a split along an axis the token still
  scopes reads as that scope, a plain value as the shared value, and a split along an axis it no longer
  scopes as before until the first write flattens it.
  
  **Breaking for stored values:** a scoped value's own values are keyed `$in`, not `$of`. A value stored as
  `{ $by, $of }` is read as `$in` by `recordValue`, which every store read and write starts from, so an old
  record reads correctly and the next write to it stores `$in`.
  
  - **Closed and open.** A selector given `overrides` is closed: only the options it names keep a value of
    their own, and every other option shares one, stored under `PREF_ELSE` (`$else`). `overrides`
    (`PrefOverrides`) is option names, or option → proposed value. A named option reads its own value once
    written; before that, its proposed value if it has one, else the shared value (decided 2026-11-01: a
    developer adding a proposed value moves what an unwritten option reads, on purpose). A selector given no
    `overrides` is open: an option reads its own value once one is written for it, and the shared value
    until then. With no option named, a selector reads and writes the shared value; whatever reaches no value
    reads `default`.
  - **Nesting.** Selectors nest in declaration order. An option's own value ends the descent, and a write
    replaces it, unless it is already split by the next selector in (as a nested `defaultScope` holds it);
    only the shared value holds the next selector in otherwise.
  - **Admitted selectors.** A schema's root lists `admits: [...]` (labkit: `f.schema(…).admits(...)`), the
    selectors its prefs may name that are no pref of it, whose option the app names through the same
    `PrefSelection` it already uses. `store.get(path, { at })` is new beside `{ weights }`. A selector that is
    neither a pref nor admitted is a `checkPrefSplits` problem: `selector "docment" is not admitted by this
    schema (it admits: document, layout)`. `prefsCss` writes no attribute blocks for an admitted selector.
  - **Changing a closed list in code** needs nothing done: a stored value of an option no longer named is
    ignored on read and dropped on the pref's next write.
  - New helpers: `prefScopesOf(pref)`, `prefOverridesOf(pref, selector)`, `prefOverrideOptions(overrides)`,
    `prefScopedDefault(pref)` and `prefScopeOptionValue(scope, option, absent, overridesOf?)`.
  - Where a scoped value is stored (with a document, or in the reader's store keyed by document) is not
    decided here; resolution assumes neither.
  
  `PrefsForm` draws a closed selector as one row per option it names and one row for the shared value,
  called `othersLabel` (default `Others`).
  
  <!-- bump-approved: minor: maintainer — 1.16.0 release requested 2026-11-02 -->

### Patch Changes

- Updated dependencies [63056ee]
  - @weasel-js/paint@1.16.0
  - @weasel-js/icons@1.16.0
  - @weasel-js/quantity@1.16.0
  - @weasel-js/react@1.16.0
  - @weasel-js/registry@1.16.0
  - @weasel-js/storage@1.16.0

## 1.15.2

### Patch Changes

- Updated dependencies [507f539]
- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
- Updated dependencies [6544399]
  - @weasel-js/paint@1.15.2
  - @weasel-js/react@1.15.2
  - @weasel-js/registry@1.15.2
  - @weasel-js/icons@1.15.2
  - @weasel-js/storage@1.15.2
  - @weasel-js/quantity@1.15.2

## 1.15.1

### Patch Changes

- b6a97f4: A number leaf takes `stops`, the values its slider catches on, declared in the stored unit like `min` and `max`: `pref.number('Level', 0, { min: -1, max: 1, stops: [0] })`, or labkit's `f.number(0).range(-1, 1).stops([0])`. `prefDisplayBounds` converts them with the bounds. Every surface drawing the leaf as a slider honors them, since `PrefsForm`, `SelectionPanel`, `Bar`, `ControlPanel`, and `ControlMatrix` all draw it through `PropertyField`, which takes `stops` too: each stop is marked on the track, a drag passing within the `targets.sliderStopSnapPx` kit setting of one lands on it unless alt is held, and an arrow key stepping across one, on the track or its readout, stops there. Additive.
- Updated dependencies [5e66a10]
  - @weasel-js/quantity@1.15.1
  - @weasel-js/icons@1.15.1
  - @weasel-js/paint@1.15.1
  - @weasel-js/react@1.15.1
  - @weasel-js/registry@1.15.1
  - @weasel-js/storage@1.15.1

## 1.15.0

### Patch Changes

- @weasel-js/icons@1.15.0
  - @weasel-js/paint@1.15.0
  - @weasel-js/quantity@1.15.0
  - @weasel-js/react@1.15.0
  - @weasel-js/registry@1.15.0
  - @weasel-js/storage@1.15.0

## 1.14.2

### Patch Changes

- dc5a786: `SelectionPanel` keeps a section nested in another as the schema writes it, where it used to fold its rows into the
  top-level section: a nested `tab` joins a strip, a `panel` is boxed, and any other section draws under a heading of
  its own, in its place among the rows. `PanelSection.rows` is replaced by `items`, its rows and nested sections in
  order; `panelRowsOf` reads every row of a section and `isPanelSection` tells a nested section from a row. Each
  `PanelSection` also carries `path`, the path its conditions name it by. A nested section is marked by its key when
  selected, as a top-level one is.
  
  A tab with no row to draw is left out of its strip on every params surface, and neither it nor anything else that
  draws nothing splits the strip. `prefTabRuns` takes the rule as an optional `draws` predicate. `PrefsPane` now
  leaves out such a tab too, except in a form given `showEmpty`; `WalkCtx` gains `showHidden` and `keepEmpty` for it.
- Updated dependencies [4bba14d]
  - @weasel-js/registry@1.14.2
  - @weasel-js/icons@1.14.2
  - @weasel-js/react@1.14.2
  - @weasel-js/storage@1.14.2
  - @weasel-js/paint@1.14.2
  - @weasel-js/quantity@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/icons@1.14.1
  - @weasel-js/paint@1.14.1
  - @weasel-js/quantity@1.14.1
  - @weasel-js/react@1.14.1
  - @weasel-js/registry@1.14.1
  - @weasel-js/storage@1.14.1

## 1.14.0

### Patch Changes

- a370edb: A list's or a map's item whose `enableIf` reads the entry (`{ from: 'item', path: 'on' }`) no longer disables the field it reads. `applyPrefEntryConditions` used to compare the condition's item-relative path with the field's full path (`phases.2.on`), so the switch that turns an entry back on was disabled with the rest of it. `PrefOwner` gains an optional `entry`, the entry's path, which `prefScopeIn` reads such a condition's paths under.
- 9a3626f: A `list` pref takes `control: 'list' | 'tokens'`. A list of plain text with `control: 'tokens'` is drawn as a `TokenField`, a chip per entry, in `PrefsForm`, `SelectionPanel` and labkit's `ControlPanel`; any other list is drawn as before. `PrefTextList` is the one control all three use for a text list.
  
  `TokenField` takes `minItems`, `maxItems` and `locked(index)`, the limits and per-entry lock `ListEditor` has.
  
  The asset editor offers `Control` on list prefs, and draws its own tag, short-name and field-kind lists as tokens.
- 28f476b: A `string` pref leaf takes an optional `placeholder`, the text an empty field shows in its place, and `PrefsForm` draws it. Adds API.
- ffdbbcf: `prefWeightAxes(options)` lays a selector's weights out as numbers, the `axes` an `@weasel-js/animator` target
  takes, so an animation can drive `store.get(path, { weights })` or `applyTheme`'s `weights` from one option to
  another. Adds API.
- ee97c81: A pref leaf says whether and how it can be auto in one field, `auto`, in place of `manual`, `unpinned` and `autoValue`, which are gone. This changes the schema shape: a schema that sets any of the three must be rewritten.
  
  | Before | After |
  |---|---|
  | none of the three | `auto` left out: the leaf can be auto, and starts pinned at `default` |
  | `manual: true` | `auto: false` |
  | `unpinned: true` | `auto: { on: true }` |
  | `autoValue: x` | `auto: { value: x }` |
  | `unpinned: true, autoValue: x` | `auto: { on: true, value: x }` |
  
  `auto: false` with either of the others, which the old fields allowed, has no spelling now. The new `PrefAuto` type names the object form.
  
  `PrefsForm` gives a leaf with `auto: false` no auto toggle. `PrefSchemaEditor`'s Auto panel keeps its three rows, Never auto, Starts auto and Auto value, and writes them all to `auto`; changing a leaf's kind keeps its `auto` but for the value, which belongs to the old kind and is dropped. labkit's auto stays opt-in, and its resolved schema now says so: `.auto()` writes `auto: {}` onto the resolved leaf, `.initial(auto)` writes `auto: { on: true }`, and every other leaf, a legacy `configSchema()` field included, gets `auto: false`. A leaf `f.prefs` carries over keeps the `auto` object its schema gave it. Every reader of a resolved labkit schema, `PrefsForm` and the schema editor among them, now finds the same answer labkit acts on.
- 8ddaf05: A schema group or section can name the motif its frame is drawn in: `motif: 'hero'` on a `PrefGroup` or `PrefSection`. `PrefsForm`, `PrefsPane` and `SelectionPanel` pass it to the group's `MotifFrame`, which looks the name up in the new `named` prop of a `<DefaultMotif>` above (`<DefaultMotif named={{ hero: stereo() }}>`). A name nothing defines draws the form's own look, as an unset one does. `MotifFrame`'s `motif` takes such a name as well as a motif.
- Updated dependencies [e1bbdcd]
- Updated dependencies [b142892]
- Updated dependencies [b59380e]
- Updated dependencies [b0a55a6]
- Updated dependencies [624cf38]
- Updated dependencies [34a364e]
- Updated dependencies [4f68c3a]
- Updated dependencies [78213f7]
- Updated dependencies [d5c4ee6]
  - @weasel-js/paint@1.14.0
  - @weasel-js/quantity@1.14.0
  - @weasel-js/react@1.14.0
  - @weasel-js/icons@1.14.0
  - @weasel-js/registry@1.14.0
  - @weasel-js/storage@1.14.0

## 1.13.0

### Patch Changes

- 7c1134c: A group's, a section's, or a leaf's `enableIf` no longer disables a leaf directly inside it that the condition reads. That leaf is the node's switch, and it stays live so the node can be turned back on. So a panel of settings that can be turned on and off, such as one layer effect, is a group whose `enableIf: { path: '<group>.on' }` reads a boolean marked `heading`: the checkbox sits in the panel's title, and turning it off disables everything else in the panel. This holds in `PrefsForm`, `SelectionPanel`, labkit's `ControlPanel`, and schema menus, and `prefScopeIn` exposes the rule to other walkers.
  
  `MotifFrame`, `PropertyGroup`, and `Subpanel` take `disabled`, which dims the title and leaves the controls beside it alone. A settings form passes it for each group its `enableIf` turns off.
- f1c1528: A section its `enableIf` turns off now dims its title, as a group's does, and its switch leaf stays live. `applyPrefConditions` names every disabled section in `disabled`, and with `keepHidden` every hidden one in `hidden`, by `prefSectionPath(at, key)`: the path of what holds the section, then its key marked so no value path can be the same (`'#look'` at a section root, `'stroke.#edge'` inside an `object` leaf, `'#look.#more'` for a section nested in another). `SelectionPanel`'s sections, and the sections of an `object` leaf in `SelectionPanel`, `PrefsForm`, and labkit's `ControlPanel`, read it through the `disabledAt` they already ask about fields.
- 3eaceb1: `orderPrefGroup` reorders a group's children, and the children of its nested groups, by a stored `PrefOrder` keyed by container path, and `resolveOrder` is the rule it follows for keys the store lacks. An `actions` leaf takes `order`, and the actions it draws follow it, with any it does not name at the end.
- aba2016: `Bar` takes `order`, a `PrefOrder` that sets the order of its items and groups, and `onReorder`, called with the new order when the user moves one. Passing `onReorder` turns reordering on: hold Cmd and drag an item to move it within its group, or Cmd+Shift and drag a group to move it among the others; with the keyboard, Alt+arrows move the focused item and Alt+Shift+arrows move its group. A plain press still clicks, nothing crosses a group boundary, Escape cancels a drag, and the new position is announced. The same works along a straight or a curved bar. The kit stores nothing: a host keeps the order itself, as a user pref.
- Updated dependencies [04b862d]
- Updated dependencies [86f67ad]
  - @weasel-js/quantity@1.13.0
  - @weasel-js/icons@1.13.0
  - @weasel-js/paint@1.13.0
  - @weasel-js/react@1.13.0
  - @weasel-js/registry@1.13.0
  - @weasel-js/storage@1.13.0

## 1.13.0-rc.0

### Patch Changes

- 3eaceb1: `orderPrefGroup` reorders a group's children, and the children of its nested groups, by a stored `PrefOrder` keyed by container path, and `resolveOrder` is the rule it follows for keys the store lacks. An `actions` leaf takes `order`, and the actions it draws follow it, with any it does not name at the end.
- aba2016: `Bar` takes `order`, a `PrefOrder` that sets the order of its items and groups, and `onReorder`, called with the new order when the user moves one. Passing `onReorder` turns reordering on: hold Cmd and drag an item to move it within its group, or Cmd+Shift and drag a group to move it among the others; with the keyboard, Alt+arrows move the focused item and Alt+Shift+arrows move its group. A plain press still clicks, nothing crosses a group boundary, Escape cancels a drag, and the new position is announced. The same works along a straight or a curved bar. The kit stores nothing: a host keeps the order itself, as a user pref.
- Updated dependencies [04b862d]
- Updated dependencies [86f67ad]
  - @weasel-js/quantity@1.13.0-rc.0
  - @weasel-js/icons@1.13.0-rc.0
  - @weasel-js/paint@1.13.0-rc.0
  - @weasel-js/react@1.13.0-rc.0
  - @weasel-js/registry@1.13.0-rc.0
  - @weasel-js/storage@1.13.0-rc.0

## 1.12.0

### Patch Changes

- Updated dependencies [b571ad6]
- Updated dependencies [400b393]
- Updated dependencies [40d87f7]
- Updated dependencies [78f29de]
- Updated dependencies [2c52cc5]
- Updated dependencies [3bf5edb]
- Updated dependencies [91a1d84]
  - @weasel-js/paint@1.12.0
  - @weasel-js/react@1.12.0
  - @weasel-js/storage@1.12.0
  - @weasel-js/icons@1.12.0
  - @weasel-js/quantity@1.12.0
  - @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- e30f4df: `DiagramView` can hold DOM against its nodes, groups and edges, report what the pointer is over, and let a group's members be dragged into a new order. All three are additive.
  
  - `overlays` places each `DiagramOverlay` against its target after every paint: centered on it, or beside it through geom's `placeRect`, flipping inside the view. An edge's place is the midpoint along its route. The view now renders a box around its canvas to hold them, and `className` goes on that box rather than on the canvas.
  - `onHover` reports the node, group or edge under the pointer; `pickEdges` lets a click or a hover land on an edge whatever editing callbacks are set. `rectOf(id)` and `subscribeFrame` on the ref give a target's client rect and when to read it again.
  - A `DataGroup` with `reorder: 'x' | 'y'` lets `onReorder` drag any member along that axis, carrying everything inside a member that is a group, or step the picked one with Alt and an arrow key. It reports `{ group, order }` and moves nothing. `layered` keeps such a group's members in the order given across every rank instead of sorting them by crossings. `createReorderAction`, `createStepReorderAction`, `reorderBindings` and `reorderContribution` are exported for use outside `DiagramView`.
  
  `SceneCanvas` takes `onHover`, called when the topmost pickable node under the pointer changes. `@weasel-js/react` exports `adoptCss`, `adoptCssOnce` and `styleRootOf`, the stylesheet adoption core's canvas and `KitSettingsFromPrefs` now share.
- 8cd81e7: Adds API: `prefLeafValue(leaf, held, { unset })` in `@weasel-js/prefs` answers what a params surface shows for the value held at a leaf: that value, else the leaf's default. `prefValueAbsent(leaf, held)` says whether a value counts as held: `undefined` and `null` do not, except a paint's `null`, which is "no paint". `PrefsForm`, `PrefControl`, `SelectionPanel`, and labkit's `ControlPanel` and matrix all read a leaf's value through it.
  
  Changes what three surfaces show. A value held as `null` now shows the leaf's default in `PrefsForm` and `ControlPanel` (it drew an empty field), and reads as nothing held in `SelectionPanel`, where an `absentIsDefault` leaf shows its default. A clearable leaf holding nothing shows as cleared everywhere: `PrefsForm` drew a clearable number at its default, and `ControlPanel` did too when the config lacked the key.
- 433540d: A container's unit scope (`ContainerNode.units`) now reaches grid snapping and node property
  fields. A scope converts what is shown, typed and snapped to; every pose is still stored in world
  units, and pose composition does not scale by it.
  
  - `gridSnapSource({ scopes: { root, spacing? } })` snaps the subject on the pitch of the unit
    scope its nodes share, so a node inside a millimeter sub-assembly snaps on millimeter spacing.
    `spacing` is read in that scope's units unless `scopes.spacing` gives a pitch per scope.
    `scopedGridPitch` answers the pitch for a chain of scopes.
  - A snap source is told the gesture's subject: `SnapCollect.ids`.
  - `sceneSharedUnitScopes(scene, ids, root)` is the run of unit scopes every node of `ids` sits in.
  - A number leaf takes `measure: 'length'` for a length stored in world units.
    `prefLeafInScopes(leaf, scopes)` gives such a leaf the unit of the scopes it is shown in, built by
    `scopedPrefUnit(scopes)`: shown in the innermost scope's base unit, with every unit of its system
    accepted as typed text. The kit's node schemas mark X, Y, W, H and text padding as lengths.
  - `SelectionPanel` takes `units`, the scene's outermost scope; given it, a length field shows the
    selected nodes' shared scope.
- Updated dependencies [e30f4df]
- Updated dependencies [f819e61]
- Updated dependencies [433540d]
  - @weasel-js/react@1.11.1
  - @weasel-js/icons@1.11.1
  - @weasel-js/quantity@1.11.1
  - @weasel-js/paint@1.11.1
  - @weasel-js/registry@1.11.1
  - @weasel-js/storage@1.11.1

## 1.11.0

### Patch Changes

- 304f53a: Actions and prefs carry `tags`: words they are also found by and gathered under. `Action.tags` and `ActionVariant.tags` (a variant carries its action's and its own, as `ActionItem.tags`); `tags` on every pref leaf, `PrefGroup`, and `PrefSection` (a leaf carries every group's above it). One matcher, `matchQuery` in `@weasel-js/registry`, now serves the command palette's search and `filterPrefSubtree`, so a query matches a tag as it matches a label, and `hasTag` is the exact test. Gathering by tag: `actionsTagged`, `taggedActionItems`, and `matchActionItem` (routing, re-exported by core), and `prefLeavesTagged` / `prefLeafTags` (prefs). `<ActionBar tag="…">` draws a bar from a tag in place of a `group`. A `CommandPalette` row found by a tag and not its label names that tag beside the label. The schema editor edits `tags` on leaves, groups, and sections; its structure, settings, unplaced, and action trees find rows by tag through the same matcher; and an `EditorAction` carries its registered action's tags, shown among what the registry says of the action a pref fires. `flip` is tagged `mirror`. Additive.
- 65be8d3: A group or a section can name a glyph: `icon?: IconRef`, as a pref leaf's `icon` already does. A bar with `lead: 'icon'` (new beside `'label'`) starts its line with that glyph, in `Bar`, `PrefsForm`, `SelectionPanel` and labkit's `ControlPanel`. The button a bar opens a `menu`, `page`, `tab` or `panel` group from draws the glyph before its name, and so does that group's submenu row in a menu built by `resolveSchemaMenu`. `BarMenu` takes an `icon` as `BarPopover` does, and `BarLayout` and `Bar` take an `icon` prop. The schema editor offers `icon` for those groups and `icon` as a lead.
- 10b67bb: A group or section drawn `as: 'bar'` takes `lead: 'label'`, which starts its line with its name ahead of its cells. `Bar` takes the same as a `lead` prop, over what its schema says, and every surface that draws a bar honors it. The asset editor offers it beside Overflow for a bar. New public API: `PrefBarLead`, `PrefGroup.lead`, `PrefSection.lead`, and `BarProps.lead`.
- 4da5998: `ControlPanel` writes a typed number or text once, when the edit settles on Enter or blur, so one typed value is one undo step; Escape writes nothing. This changes what a panel with no `draftConfig` does: it used to write every keystroke. The new `draftConfig` prop takes the values an edit passes through, a typed field's keystrokes and a slider's drag, so an instrument can follow the edit while `setConfig` hears only the settled value. A lab's Settings panel passes one, and still updates as you type.
  
  A `.dialog()` row and a compound leaf's dialog now edit a draft: Done writes it once, and the new Cancel button, Escape, or a press outside the dialog drops it. `DialogRow` takes `onOpen`, `onDone`, and `onCancel` for this; given `onCancel`, it draws Cancel beside Done.
  
  A `.resettable()` group's reset writes the group's whole value at its own path, once, rather than one write per changed leaf.
  
  A number can be cleared: `f.number(4).clearable()` writes `undefined` when its field is emptied and left, and `f.number()` with no default starts unset. `.placeholder()` says what an empty field stands for, and `.min()` and `.max()` bound a number on one side. Underneath, `PrefNumber` gains `clearable`, and the number `PropertyField` and `UnitField` take `onClear`.
  
  `PropertyRow`, `PropertyField`, and `DialogRow` take `error`, a validation message drawn under the control as an alert. `ControlPanel` takes `errors`, keyed by path, and a custom row gets its own as `ctx.error`.
  
  A `showIf` or `enableIf` comparing an enum with a string none of its options is no longer throws out of `resolveConfigSchema`: it warns in development and never matches. `checkPrefCondition` reports it under a new code, `option`.
  
  A section or group whose rows are all hidden no longer draws its heading.
  
  A text `PropertyField` drops its draft on Escape and gives `onInput` back the value typing began from.
- 63b310c: Icons are named, not drawn, by the code that uses them. This is breaking.
  
  `@weasel-js/icons` is new. An icon is a qualified name, `namespace:name` (`core:undo`, `ui:close`, `path-tools:reversePath`), held as an `IconRef`. Each package's `icon()` makes one and qualifies its own bare names: in core, `icon('undo')` is `core:undo`. A registry supplies the glyphs: mount `<IconRegistryProvider icons variants>` from `@weasel-js/core` at the app root, or give `<WeaselProvider>` its new `icons` and `iconVariants` props. Core, ui and path-tools each publish their table at `./icons` (`import { icons } from '@weasel-js/ui/icons'`). A name no registered table holds draws a placeholder and warns in development, and draws nothing in production.
  
  `@weasel-js/icons-plugin` is new too. Its build plugin, `weaselIcons`, ships only the glyphs a build names. In an app's vite, rollup or rolldown build, `weaselIcons.vite({ mode: 'app' })` serves `virtual:weasel-icons`, holding the glyphs named by the app and by the weasel packages it imports, and fails the build on a name no table holds. `virtual:weasel-icons/all`, `/<namespace>` and custom variants each load as their own chunk, asked for with `useIconVariant(name)`. Types for the virtual modules are at `@weasel-js/icons-plugin/virtual`. The plugin is its own package so that installing `@weasel-js/icons` does not install a native parser. Core's and ui's `dist` is no longer minified, so the `@icon` annotations the plugin reads survive; a consumer's bundler minifies.
  
  What breaks:
  
  - routing: `Action.icon`, `ActionVariant.icon`, `ActionItem.icon` and `ToolPresentation.icon` take an `IconRef` from `icon()`, not a React node. So does `useCommand`'s `icon` option, which no longer takes a function read each time the command shows.
  - prefs: `PrefBase.icon` and an enum option's `icon` take an `IconRef`, not a free string. A schema saved with bare names, such as `"icon": "close"`, now draws nothing for them and warns in development; write `"ui:close"`.
  - core, ui and path-tools: the `…Icon` components are removed; draw `<Icon name={icon('core:rect')} />` instead. `NudgeAnchorsIcon` and its `dir` prop become four glyphs, `core:nudgeAnchors` (pointing right), `core:nudgeAnchorsUp`, `core:nudgeAnchorsDown` and `core:nudgeAnchorsLeft`. Core's `PaintKindEntry.icon` and `PaintKindFamily.icon` take an `IconRef`. Core's `ACTION_GLYPHS`, `IconProps` and `ActionGlyphProps` are gone, and so are ui's `ICON_PATHS`, `ICON_FILLS`, `ICON_GROUPS`, `MARK_ICONS`, `IconName`, `MarkIconName`, `FillableIconName` and `ActionIconSource`.
  - ui: `<Icon name>` and `mark`, `actionIcon` and `ActionBar`'s `icons` take `IconRef`s, and `isFillable` takes a glyph. `resolveIcon` draws a ref, or a qualified string read from data. `iconFromData(value)` reads a name from data as a ref, warning once in development about a bare one.
  - labkit: `CommandItem`, `ToolItem`, `ViewportControl` and `TrialTool` take an `IconRef` as `icon`, and so does `ConfigOption.icon`. `IconComponent`, the nine ui icon components labkit re-exported, and its `ICON_PATHS` and `IconName` are gone.
  - forge: `GlobalDeclaration.icon` takes an `IconRef`. `FrameSetup.icons` registers an app's own tables in every frame. A story's `control.icons` argTypes option takes qualified names (`'ui:statusSuccess'`); a bare `'statusSuccess'` now draws nothing.
  
  `@weasel-js/registry` exports `isDev()`, which `@weasel-js/react` re-exports. It reads `process.env.NODE_ENV`, which a production bundle folds to `false`, and the development diagnostics in core, routing, ui, labkit, renderer and animator all read it.
- 628c62d: A prefs schema can now reach CSS without a store, and a store can drive the kit's settings. `prefsDefaultsSource(schema)` reads a schema's defaults the way a store at defaults does, so `prefsCss(prefsDefaultsSource(schema))` writes its stylesheet. The new `@weasel-js/prefs/vite` entry exports `weaselPrefsCss({ schemas, css })`, a Vite plugin that serves that sheet for each named schema as `virtual:weasel-prefs.css` and rewrites it when a schema or anything it imports changes; `vite` is an optional peer. `<KitSettingsFromPrefs store at css>` in `@weasel-js/prefs/react` feeds a store's values to `KitSettingsProvider` from `@weasel-js/react`, now a dependency, and with `css` adopts them as `--wzl-kit-*` custom properties into the document or shadow root it renders in, named by `kitSettingsCssOptions(at)`. `prefsCss` with `root: ':host'` now matches its attributes as `:host([…])`, which a shadow root's sheet needs. Additive.
- 797bf34: A number row in a menu drawn from a schema now honors the leaf's `endless` and `infinity`. An endless end sits one step past its bound, as it does on an endless slider, so stepping up from the bound reaches infinity, and an infinity stored there shows as the leaf's word for it, with no unit after it. This holds in the DOM menu and the HUD menu alike. The DOM menu's field also reads typed units now, in any unit the leaf's `unit` accepts.
  
  `clampToBounds` and `spinKey` in `@weasel-js/quantity` take an `endless` bound. `endlessAllows`, `endlessAt`, `endlessTrack`, and the `Endless` type have moved there from `@weasel-js/ui`, which still re-exports `Endless`. `UnitField` takes `endless` as well, so a property row's plain number field keeps an infinity typed at an endless end where it used to clamp it to the bound. `prefUnitAccepts` is now exported from `@weasel-js/prefs`, which ui and routing both use. `prefDisplayBounds` returns the leaf's `endless`, with its ends swapped under a unit that runs backward. `MenuNumberEntry` gains `endless`, `infinity`, and `accepts`. `menuNumberText` now takes the entry in place of a suffix and a display.
- 2f51085: Menus take access letters and links. `access` on `PrefBase`, `PrefGroup` and `PrefSection` names a menu item's letter; the resolver carries it, and an alias's own letter wins over its target's. `@weasel-js/menu` gains `accessMatch` (finds the item a typed letter selects), `withLinks` (runs a link row's `href` through a navigator the host passes), and `href` and `current` on items. `onEdge` is new on the menu controller, called when Left or Right is pressed at a boundary. Link rows now navigate in the WebGL host. `KeyEffect` gained an `edge` variant, and `keyStep` now returns it for Left and Right at a boundary, which breaks a consumer that switches exhaustively over the effect: add a case for it.
- c6d61e0: Add `mergePrefGroups(name, ...groups)`: one group holding every child of the groups given, merging
  groups that share a key and throwing where a leaf meets anything at the same path. It composes
  schemas that add to the same areas, such as the kit settings groups `ui` and `core` both export.
- 0430dcc: Every type a public signature names is now exported, so the API reference links it. Signatures that named a file-local point alias (`Pt`, `XY`, `Vec`) take geom's `Point`, and ones that named a local `AnyScene` or `AnyNode` say `Scene<unknown, string, unknown>` or the node type outright. Newly exported: core's `AnnotationFlag`, `AnchorEdit`, `JoinPlan`, `PathEditPreview`, `PathStorageKind`, and `ViewPoseAdapter`; diagram's `RoutedScene`; prefs' `UsePrefsStoreOptions`; symmetry's `SymmetryKindDef`; path-tools' `WarpToolOptions`; and ui's `SceneLayerListProps`.
- 798e9b0: The Properties W and H fields hold a node to its `data.minSize`, as resize and
  insert already do: typing a smaller width shows and stores the minimum. With
  several nodes selected, each is held to its own minimum.
  
  A number leaf takes `minAt` and `maxAt`, bounds read from where its value is
  held, which `prefNumberAt` folds into `min` and `max` for one holder.
  `SelectionPanel` resolves them per node, `PrefsForm` and labkit's
  `ControlPanel` against their values. `prefClampNumber` holds a number to a
  leaf's range.
- c4e499e: A declared menu is now a prefs schema. `MenuDef` holds `menu: PrefGroup` in place of `sections`, and `MenuDefEntry` and the `actionVariants` entry are gone: an action leaf naming a parametric action already lists one row per variant, and one naming `id:variant` lists that variant alone. `resolveSchemaMenu(schema, sources, at?, params?)` draws any schema subtree as menu entries, so a toolbar can open one as a menu; `resolveMenu` calls it, and core re-exports it with the `MenuSources` type. An `actions` leaf lists every action in its registry group, a group drawn `as` a `menu`, `page`, `tab`, or `panel` is a submenu, and any other group sits inline between separators. Booleans become checked items and enums radio rows, read through the new optional `MenuSources.values` and written through `MenuSources.onChange`; a `readout` one is a disabled row showing its state. An `action` leaf naming no registered action is a disabled row that warns in development, since a menu holds no code. A `label` leaf is a disabled row, a `separator` leaf a separator, an `alias` the leaf it points at (in `MenuSources.over`, else the menu's own schema), and `showIf`/`enableIf` hide and disable rows when `values` is given. Leaves a menu cannot edit, such as numbers and colors, are left out. Menus contributed under one id merge as each contribution's children in turn with a separator between, keeping their keys, so value paths do not move. `pref` gains `action`, `actions`, `label`, and `separator` builders. Breaking for any declared menu written with `sections`.
- 5ebf7e7: A group or a section can be drawn `as: 'menu'`: on a bar, a button opening its contents as a menu; in a menu, a submenu; in a panel, a titled box as `panel` is. `prefAsBox` answers whether a panel boxes a node drawn `as` a given value.
  
  Every leaf holding a value takes `readout: true`, meaning it is drawn showing its value but not editable. The field lives on the new `PrefValueBase`, so an `action`, `alias`, `label`, or `separator` cannot carry it.
  
  A new leaf kind, `actions` (`{ kind: 'actions', group }`), stands for every action the host registered in an action group, in registry order, each drawn as an `action` leaf would be. It holds no value: a store neither reads nor writes it, and it has no `PrefPath`. The schema editor offers both new fields and the new kind.
- Updated dependencies [304f53a]
- Updated dependencies [63b310c]
- Updated dependencies [b36ceac]
- Updated dependencies [34f8b09]
- Updated dependencies [c6a0a52]
- Updated dependencies [ad0b069]
- Updated dependencies [d32cb70]
- Updated dependencies [90851d1]
- Updated dependencies [797bf34]
- Updated dependencies [974682d]
- Updated dependencies [1be2ea9]
- Updated dependencies [59b5936]
- Updated dependencies [d705830]
- Updated dependencies [398d71e]
  - @weasel-js/registry@1.11.0
  - @weasel-js/icons@1.11.0
  - @weasel-js/react@1.11.0
  - @weasel-js/quantity@1.11.0
  - @weasel-js/paint@1.11.0
  - @weasel-js/storage@1.11.0

## 1.10.1

### Patch Changes

- b6e04e2: `ActionBar` is a `Bar` of `action` leaves, one per registered action in its group, so it draws its buttons, tooltips, and disabled and pressed states the way every other bar does. Breaking: its `icons` prop takes icon names (`Record<string, string>`, glyphs of the kit's icon set, as a leaf's `icon`) where it took `ReactNode`s, and its buttons no longer carry `data-testid="action-bar-item-<key>"`; find one by its role and name. `Bar`'s gap reads `--bar-gap`, which `ActionBar` sets to keep its buttons close.
  
  A group or a section drawn `as: 'bar'` says what happens to the cells its line has no room for. Additive: `PrefGroup` and `PrefSection` gain `overflow` (`'scroll'`, the default, or `'menu'`), typed `PrefBarOverflow`, and every surface that draws such a bar reads it: `Bar` (under its own `overflow` prop), `PrefsForm`, `SelectionPanel`, an object leaf's rows, and labkit's `ControlPanel`, whose builder gains `.overflow()`. `PrefSchemaEditor` offers it as "Overflow" on a node drawn as a bar. A form that takes drops, as the schema editor's preview does, keeps every cell on the line whatever the group says, so each stays a place to drop beside. `scroll` stays the default because a bar set to `menu` takes all the room its host has along the line.
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- 10449af: A leaf's default may be split. `defaultLocus` on a leaf that lists `splitBy` is what it holds while nothing is stored for it: `store.get` reads the member the selectors name, `store.locus` and `store.loci` report it, a first `set` writes into the member and keeps the others, and `reset` returns to it. `default` stays what a member it leaves out reads as. A `defaultLocus` split by a selector the leaf's `splitBy` does not list is ignored, and the store warns of it when it opens (`checkPrefSplits` code `default`).
  
  A store over a schema whose keys are not literal, as one built at run time has them, now types every value as `unknown`. It typed them as `never`, so no `set` on such a store compiled without a cast.
- e05a5f9: Additive. `pref` builds a schema in short form: `pref.group(name, children)`, `pref.section(name, members)`, and `pref.number`, `pref.boolean`, `pref.string`, `pref.color`, and `pref.enum` for leaves, each returning the plain data the literal would hold. `prefsCss(store)` writes a store's values as CSS custom properties, with a block inside `:where()` for each choice of options a split value tells apart, and `prefsCssAttributes(store)` gives the attributes that pick those blocks.
- d30823f: A leaf marked `heading` is drawn in the heading of the group holding it, in place of a row of its own. Additive: `PrefLeaf` gains `heading`, which labkit's `.heading()` already wrote and only `ControlPanel` read; `@weasel-js/prefs` exports `prefHeadingKey` and `prefFitsHeading`, which say which leaf a heading carries and whether a control fits there (a built-in `boolean` or `enum`). `PrefsForm` draws it in a page's, a section's, a panel's, and a column's heading, under the group's name, and `PrefSchemaEditor` lists the attribute as "In heading".
  
  labkit's `sectionTree` marks the leaf a control panel would lift, so a form drawn from it shows the same control in the same heading, including a first row that only repeats its heading. Its warning for that row now says the row is drawn in the heading, as the panel's does.
- 0be7a53: A leaf's value can be split by another setting. Additive: a leaf lists the `enum` leaves it may be split by in `splitBy`, and its stored value may then be a locus, `{ $by, $of }`, holding one member per option of that leaf, nested for a second one. `store.get` reads the member the selectors are set to, `store.set` writes it, and `store.split`, `store.join`, and `store.locus` turn a value into a locus, back, and read it. `store.get(path, { weights })` folds the members by weight, a number linearly and a color in OKLCH, and every other kind takes its heaviest; `blends` in the open options gives a kind its own. `store.values({ at })` is the tree under a stated choice of selectors, `store.set(path, value, { at })` writes the member such a choice names, and `store.loci()` is every split leaf's locus by path. A selector changing is reported to subscribers as a change to every leaf split by it. `@weasel-js/prefs` now depends on `@weasel-js/paint`, for the color blend.
  
  `PrefsForm` draws and edits split values. Additive: given `loci`, `onSplit`, `onJoin`, and `onChangeAt`, which `usePrefsValues` now returns as `loci`, `split`, `join`, and `setAt`, a leaf that lists `splitBy` marks the option each selector is set to beside its name and opens, under its row, to its own control for every option and to a Split or a Join for each selector. `defaultSplitOpen` names the rows open at first. A row that offers any of this is a group and no `<label>`, so an app renderer's control on such a leaf has to carry its own accessible name.
- 365eae0: A linear unit stores a decimal typed at a decimal `scale` as the decimal the two multiply to: 33.3 at a scale of 0.01 is 0.333, where it was 0.33299999999999996. Nothing is rounded away, and a scale that is no short decimal (degrees over radians) converts as before.
  
  The text tool's percent unit for `fontScale` and `baselineShift` is that data now (`{ scale: 0.01, precision: 1, suffix: '%' }`) and no longer a pair of functions, so the run properties print as a literal. Breaking in one detail: a percentage typed to more than three places is stored as typed, where it was cut to five places of the stored fraction.
  
  labkit's one-line summary of a compound leaf writes each number that has a unit as its field shows it, in an object's fields, a list's and a map's entries, and a union's variant, and writes a list of objects entry by entry where it wrote `[object Object]`. Additive: `summarizeLeaf(leaf, value)` is exported beside `summarizeValue`, and `inDialog`'s default summary is the leaf's.
- Updated dependencies [b8bfb2d]
- Updated dependencies [886380f]
  - @weasel-js/storage@1.10.1
  - @weasel-js/paint@1.10.1
  - @weasel-js/quantity@1.10.1
  - @weasel-js/registry@1.10.1

## 1.10.0

### Patch Changes

- a695295: Fixes: a vertical bar inside a `PrefsForm` named the popover of an alias with no name of its own with the empty string. It is named for the leaf the alias shows, as a standalone `Bar` names it, and an alias that shows nothing is named `Alias` in both.
  
  Adds API: `prefAliasName(alias, target?)` in `@weasel-js/prefs`, what an alias is called wherever one is drawn: its own name, else its target's, else `Alias`. `prefAliasedLeaf`, the bars, and the row a form or a `ControlPanel` draws for an alias of nothing all name one through it.
- 122a09c: An alias row answers for the leaf it shows as well as for itself. It is shown only while its own `showIf` and its target's both hold, and enabled only while both `enableIf`s hold, and the target's side counts every group or section above the target. Before, only the alias's own conditions were read. `applyPrefConditions` and `prefScopeAt` apply the rule, so `PrefsForm`, `SelectionPanel`, `Bar`, and labkit's `ControlPanel` and `ControlMatrix` all follow it; in labkit a function passed to `.showIf` or `.enableIf` on the target or a group above it counts too.
  
  Adds API: `applyPrefConditions` and `prefScopeAt` take `aliasOver`, the schema an alias's `of` names a leaf of when that is not the schema walked. `prefScopeAt` now answers for a `PrefSection` schema as well as a `PrefGroup`.
- bc7cd74: `PrefsForm` and `PrefsDialog` take `over`, a `PrefGroup` or a `PrefSection`: the schema their `alias` leaves point into, when that is not the form's own. It replaces the `leafAt` function, which never shipped. An alias row is drawn as the leaf of `over` at the alias's path, reads and writes `values` at that path, and is hidden and disabled by that leaf's conditions and those of every group above it, as well as by its own. Those conditions read `values`, and `over`'s defaults where `values` holds nothing. Before, an alias into another schema answered to its own conditions alone.
  
  Breaking: `filterPrefSubtree`'s fourth argument is the schema an alias's target is looked for in, where it was a function from a path to a leaf. A caller that passed `(path) => prefLeafAt(schema, path)` passes `schema`.
  
  Adds API: `applyPrefConditions` and `prefScopeAt` take `aliasHolds` beside `aliasOver`, the judge of that schema's conditions when its values are not the ones the walked schema's judge reads. `prefReader` reads a `PrefSection` schema as well as a `PrefGroup`.
  
  Fixes: an alias of an `object` leaf drew a field marked `hidden`, and a field whose `showIf` hid it in the leaf's own row, and left enabled a field an `enableIf` disabled there when the form left the leaf itself out. The alias row now shows the leaf as its own row would.
  
  Fixes: `Bar` drew an alias as `(alias: no pref at …)` whatever it pointed at. It now draws the control of the leaf the alias shows, over that leaf's value, in a cell and in a row of a group it opens.
- 89a2c50: A bare test, `{ path: 'stops' }`, now means the value is set, and an empty list, a map with no keys, and an object holding no fields are not set. It held for all three before, since each is truthy. Every other value reads as it did: a boolean that is on, a number other than 0, a string that is not empty, and a paint that is not `null` are set. `PrefTest`'s docstring says what set means for each kind.
- d9620a2: `checkPrefCondition` reports an `in` of no values, which never holds, under the new code `never`. `PrefConditionEditor` says so on a row whose "is one of" has every option unchecked, and `PrefSchemaEditor` marks that node's row in the structure tree.
- bc9f367: A test may read from the entry its field sits in. `{ from: 'item', path: 'mode' }` on a field of a list's or a map's item reads `mode` from the same entry, where a test without `from` reads the schema root. Inside a list within a list it is the nearest entry, an item's own `enableIf` may read its entry, and an empty path is the entry itself. `PrefsForm`, `SelectionPanel`, `Bar`, and the dialog a labkit `ControlPanel` row opens each hide and disable a field entry by entry.
  
  Adds API to `@weasel-js/prefs`:
  
  - `PrefTest` takes `from: 'item'`, and `PrefConditionReader` is the reader `prefConditionHolds` asks, told where each path is read from.
  - `applyPrefConditions` and `prefScopeAt` have no entry to read, so inside an item they leave a condition that reads the entry holding. `applyPrefEntryConditions(item, path, holds)` answers those for one entry and returns the item as that entry draws it with the paths it disables. `prefJudge` takes a third argument, the `PrefEntry` to read.
  - `checkPrefCondition` holds a path read from the entry to the item of `site.within`, and reports the new code `no-item` for one on a node that is in no list or map.
  - `prefConditionPaths(condition, 'item')` lists the paths read from the entry, and without the argument lists only those read from the root, which is a change for a condition that has both. `mapPrefConditionPaths` tells its callback where each path is read from. `prefConditionReadsItem` says whether a condition reads the entry at all.
  
  Adds API to `@weasel-js/ui`: `PrefRenderContext` and `PropertyRenderContext` gain `entryAt`, which a custom renderer that draws its own entries calls for each; `PrefControl` takes `entryAt`; `entryApplier` makes one from a judge. `PrefConditionEditor` takes `entryOf`, the list or map whose entry the condition's node is drawn in, and then offers that entry's own fields first, each named as the entry's ("this Phase: mode"). `PrefSchemaEditor` offers "Enabled if" on a list's or a map's entry, with those fields to pick from, and no "Shown if" there. labkit's `conditionedLeaf` returns `entryAt` as well.
  
  Breaking for a caller of `prefShownReader`, whose returned reader and `read` argument are now `PrefConditionReader`s, and of `conditionedSections`, which returns `entryAt` beside what it returned.
- a15b3f8: A `showIf` or an `enableIf` on a node of a surface's own schema may read a setting of `over`, the schema the surface is drawn over. A path no leaf of the surface's own schema holds is looked up in `over`, in `PrefsForm`, `PrefsDialog`, `Bar`, `ToolOptionsBar`, `SelectionPanel`, and labkit's `ControlPanel`: the condition compares the value as that leaf's control shows it, through its `encoding`, where before it compared the stored value. A path both schemas hold reads the surface's own leaf.
  
  Where the surface holds no value at such a path, it reads `over`'s leaf as it reads a leaf of its own. A `PrefsForm` and a `ControlPanel` take the leaf's default, where before the path read as unset. A `SelectionPanel` takes the default only of a leaf that is `absentIsDefault`, and a `Bar` reads `values` alone.
  
  Adds API in `@weasel-js/prefs`: `prefJudge`, `prefReader`, `prefShownReader`, `checkPrefCondition`, and `checkPrefConditions` each take `over` as a last argument, and `prefSchemaHolding(schema, path, over)` says which of the two answers for a path. With `over`, the checks report `no-leaf` only for a path neither schema holds, and hold a comparison to whichever leaf answers.
  
  `PrefConditionEditor` takes `over`: its pickers list that schema's prefs after the condition's own, each named for the schema it is in (`Settings: view.grid`), and a row that reads one is checked against it. `PrefSchemaEditor` hands a layout's conditions the dialog the layout is drawn over, so its `bad condition` badge and its condition rows know that dialog's settings. `conditionLeaves` takes `over` as a third argument and marks each such leaf `over: true`.
  
  labkit: `resolveConfigSchema` takes `over` as a third argument. Without it a schema whose condition reads a setting of another schema is refused, as any condition that reads no leaf is. `conditionedLeaf` takes `over` as a last argument, and `selectionJudge` in `@weasel-js/ui` as a fourth.
- 95c01e4: A condition over a boolean or an enum leaf stored through an `encoding` now compares the value its control shows, in every surface. `{ path: 'data.style.fontStyle', is: true }` holds while the Italic toggle is on, where it used to compare `true` against the stored `'italic'` and never hold; a test with no operator held for any stored string, `'normal'` included. A field of an `object` or a `union` leaf is read against that object, as its control reads it.
  
  Breaking: `prefJudge` takes the schema first, `prefJudge(schema, read)`, and `read` still hands back stored values. Adds `prefShownReader(schema, read)`, the reader a judge compares through, and `prefShownValue(leaf, stored, siblings)`. `PrefsForm`, `SelectionPanel`, `Bar`, and labkit's `ControlPanel` all judge through `prefJudge`. `checkPrefCondition` now rules out a comparison against an encoded leaf's stored form: for an encoded boolean anything but `true`, `false`, or `null`, and for an encoded enum anything but one of its options or `null`. labkit's `isEntryShown` is given no resolved schema and still compares stored values.
- 6273d6c: A `list`'s or a `map`'s `item` now has its conditions applied, in `PrefsForm`, `SelectionPanel`, `Bar`, and the dialog a labkit `ControlPanel` row opens. A field of an object item hides by its `showIf` and disables by its `enableIf` in every entry, and the item's own `enableIf` disables every entry's control. An item's own `showIf` is not asked.
  
  Adds API: `applyPrefConditions` walks an item, and names what it disables once for every entry, with `PREF_ENTRY` (`'*'`) as the entry's step: `'phases.*'` for the item, `'phases.*.hold'` for a field of it. `prefScopeAt` answers for a path inside an entry, whatever the entry's step. `PrefControl` takes `disabledAt`, for an owner that has applied the conditions itself. labkit adds `conditionedLeaf`, and the dialog a `ControlPanel` row opens for an object, a union, a list, or a map now hides and disables that leaf's fields by their conditions, which it did not do for any of them.
- 38866bc: A `showIf` on a list's or a map's `item` is now a bad condition: `checkPrefConditions` reports it with the new code `item-show` and says where the condition belongs, on the entry's fields or on the list. An item is drawn with each entry and was never hidden, so the condition did nothing before and was not mentioned. `enableIf` on an item is still read. A store warns of it when it opens, labkit's `resolveConfigSchema` throws on it, and `PrefSchemaEditor` marks the list's row.
  
  Adds API: `checkPrefCondition` takes a third argument, a `PrefConditionSite` saying where the condition's node sits: `within`, the list or map it is inside an entry of, and `itemShowIf`.
- 7f8ab55: Adds API: `PrefsForm`, `PrefsDialog`, and `SelectionPanel` take `markHidden`, which draws each node whose `showIf` fails where they otherwise leave it out. The node is dimmed and carries a `hidden` badge on its row or its heading, and it takes a press, a selection, and a drag as any other row does. A group, a page, or a headed section hidden whole carries one mark for everything in it. A node an `enableIf` disables is drawn disabled either way. It is for a surface that authors the schema it draws, and `PrefSchemaEditor`'s live preview now passes it, so a pref whose `showIf` fails at the schema's defaults can be picked and dragged in the preview again.
  
  Behind it, `applyPrefConditions` takes `{ keepHidden: true }`, which drops nothing and names the path of everything hidden in a new `hidden` set, as `disabled` names what is disabled. Breaking: its third argument is now that options object, so `keepEmpty` moves from a positional boolean to `{ keepEmpty: true }`. A renderer's context gains `hidden` and `hiddenAt` beside `disabled` and `disabledAt`.
- a6dff38: Adds API, and breaks one read: a number leaf's `unit` may be data. `PrefLinearUnit` is `{ suffix?, scale, offset?, accepts?, precision? }`, where `stored = display * scale + offset`, the direction a `UnitEntry` runs toward its base, and `{ scale: 1 }` changes nothing. `PrefFunctionUnit` is the `toDisplay`/`fromDisplay` form, kept for a conversion that is not linear, and `PrefNumberUnit` is either. `resolvePrefUnit(unit)` gives `toDisplay`, `fromDisplay`, and `format` for both, and `isPrefLinearUnit` tells them apart.
  
  Breaking: `prefUnit` now returns the data form, so `prefUnit(...).toDisplay` and `rotationDegreesUnit.toDisplay` are gone, and reading `leaf.unit.toDisplay` no longer typechecks. Call `resolvePrefUnit(leaf.unit).toDisplay` instead. `prefDisplayBounds`, `prefFieldProps`, and with them `PrefsForm`, `SelectionPanel`, and labkit's `ControlPanel` already do.
  
  A data unit prints in `printSchema`'s literal in full, where a unit of functions prints as `KEEP_FROM_SOURCE`, and a draft keeps one set on a leaf the source schema does not hold. `PrefSchemaEditor` offers it on a number, and on a list's number entry, as a Unit attribute: suffix, scale, offset, places, and the suffixes it also takes. A unit of functions is still listed there as code.
- 94f353d: `SelectionPanel`, `Bar`, `ToolOptionsBar`, and labkit's `ControlPanel` take `over`, a `PrefGroup` or a `PrefSection`, as `PrefsForm` does: the schema their `alias` leaves point into, when that is not their own. An alias is drawn as the leaf of `over` at its path, and is hidden and disabled by that leaf's conditions and those of every group above it, as well as by its own. Its value is read and written at that path in what the surface already edits: `values` and `onChange` in a `Bar`, `config` and `setConfig` in a `ControlPanel`, and every selected node in a `SelectionPanel`, where a `PrefGroup`'s keys are steps of the node path and a `PrefSection`'s leaf keys are whole node paths. `ToolOptionsBar` hands `over` to its `Bar`, and `PrefSchemaEditor`'s preview of a properties layout hands its panel the schema the layout points into.
  
  Each surface reads `over`'s conditions as it reads its own schema's. A `ControlPanel` reads `config` and `over`'s defaults where `config` holds nothing, since a lab's config holds no value for another schema's leaves. A `Bar` reads `values` alone and a `SelectionPanel` reads the nodes, with a leaf's default only where it is `absentIsDefault`.
  
  Adds API: `prefAliasTargets(over, judge, options)` in `@weasel-js/prefs`, the schema a surface's aliases point into as that schema's conditions leave it. `shown(alias)` gives the leaf an alias is drawn as, under the alias's own name and description where it gives them, with the path its value lives at; `leafAt`, `disabledAt`, `hiddenAt`, and `entryAt` answer for what is inside that leaf. Every surface resolves an alias through it. labkit's `isLeafVisible` and `isLeafEnabled` take `over` as a last argument, and `ControlRow` takes it as a prop.
  
  Breaking: `effectiveSections`'s `shownOf` hands back `{ schema, targets? }`, a `PanelShown`, where it handed back the narrowed schema or null: `targets` is what that kind's aliases are drawn from. `conditionedSections` takes `over` as a sixth argument and hands back `targets` when given it, and `selectionJudge` judges a `PrefGroup` as well as a `PrefSection`.
- 56da358: `@weasel-js/prefs` gains `pairRuns`, which turns a run of neighboring items into the rows they draw: each leaf a `pair` names joins the row of the leaf naming it, and a row left with one leaf is no pair. This adds API. `SelectionPanel`, a `Bar`, an object leaf's fields, and labkit's `ControlPanel` all walk it now, where each merged pairs itself and they disagreed about a pair with one leaf left.
  
  That changes what a lone paired leaf draws. It is a row of its own under its own name, where a `SelectionPanel` row and labkit's `ControlPanel` used to label it with the pair's label, and a lone `toggle` boolean is a switch, where an object leaf or a multi-kind selection that kept half a pair used to draw a flag bar of one segment. `effectiveSections` pairs again after it intersects the kinds selected.
- c4209cb: Adds API: one answer for what a schema's conditions come to once nesting is counted, for every surface that draws one. A node is drawn only while it and every group or section above it is shown, and takes input only while it and everything above it is enabled. `applyPrefConditions(schema, holds)` takes a `PrefGroup` or a `PrefSection` schema and returns `shown`, the schema without the nodes whose `showIf` fails (and without a group or a section that leaves empty), and `disabled`, the value path of every leaf and field whose `enableIf`, or that of something above it, fails. It walks the fields of an `object` leaf and the variants of a `union`. `prefScopeAt(schema, path, holds)` answers for one path, and `prefScopeUnder` is the rule both are built on, for a walk of your own. Each takes a `PrefConditionJudge`, which says whether one condition holds: `prefJudge(read)` makes one from a function that reads a value by path, and a surface showing several values at once writes its own.
- 6ea5171: Adds API: a condition over other prefs' values, written as data. A leaf, a `PrefGroup`, and a `PrefSection` take two optional fields holding one, `showIf` (drawn only while it holds) and `enableIf` (drawn, and disabled while it does not). A `PrefCondition` is a test of one path, `{ path, is }`, `{ path, isNot }`, `{ path, in: [...] }`, `{ path, above | below | atLeast | atMost }`, or a bare `{ path }` for a value that is set, combined with `{ all: [...] }`, `{ any: [...] }`, and `{ not }`. Being plain data, it exports as a literal and survives a schema draft. `prefConditionHolds` evaluates one against a function that reads a value by path, and `prefIsShown` and `prefIsEnabled` answer for a node. `checkPrefCondition` and `checkPrefConditions` report a condition that is malformed, reads a path no leaf holds a value at, or compares a leaf against a value its kind or options rule out; a store warns of each when it opens. `prefConditionPaths` lists the paths a condition reads, and `mapPrefConditionPaths` rewrites them. Nothing draws the two fields yet: the forms in `@weasel-js/ui` do not read them.
- a071085: Adds API: `prefTabRuns(items, isTab)` in `@weasel-js/prefs` walks a group's children in order with each run of neighboring `tab` children folded into one step, the strip they share. `PrefsForm`'s panes, an object leaf's rows, `SelectionPanel`'s sections, and labkit's `ControlPanel` each collected that run in a loop of their own and now walk this one. Nothing draws differently.
- 505a75f: Adds API: `PrefsStore.closed`, true once `close` was called. A closed store reports `writable: false`, and its first `set` or `reset` warns that the write will not persist; before, the write changed the store's memory and was dropped in silence.
- 143613a: Fixes: two mounted `usePrefsStore` callers naming one `storage` and `prefix` with different schemas took the prefix from each other on every render, and one was left holding a closed store that dropped its writes. Each schema now gets a store of its own over one shared set of records, so both stay open, a write through one is read by the other at once, and the records close when the last store over them does.
  
  Changes behavior: a `schema` change on a mounted `usePrefsStore` no longer reads storage again; the new store opens over the records already held. Callers sharing a prefix must pass the same `migrations`, which run once when the first opens.
- d7af897: `PrefsForm` honors `showIf` and `enableIf`, on a leaf, a group, and a field or a section of an `object` leaf. A node whose `showIf` fails draws nothing and takes no space, and a hidden group takes its rail entry, its tab, its heading, and its sub-page with it; a group left with nothing to draw goes too. A node whose `enableIf` fails draws with its control disabled and its label dimmed, and a group's disables everything under it: every built-in kind, a list's entries and its add and remove buttons, a map's keys, a union's select, and an action's button, in a row and in a bar. A condition reads the form's `values` by path from the schema root, and a leaf with nothing stored reads as its default.
  
  Adds API: `PrefRenderContext` gains `disabled`, so a custom renderer is told, and `disabledAt(path)` for the fields under a leaf. `PropertyRow` takes `disabled`, which marks the row `data-disabled` and dims its label; `PropertyField` sets it from its own `disabled`. `ListEditor`, `MapEditor`, `UnionPicker`, and `PrefControl` take `disabled`. `prefReader(schema, values)` in `@weasel-js/prefs` is the reader the form uses.
  
  An alias row is shown only while its own `showIf` and that of the leaf it shows both hold, and enabled only while both `enableIf`s hold, with every group above that leaf counted.
- bbb538e: A subscriber that throws no longer stops the ones after it, and no longer throws into whatever caused the notify. This holds for a prefs store's `subscribe`, font's `subscribeGlyphReady`, and renderer's `subscribeImageReady`, which now share `@weasel-js/registry`'s emitter: the error goes to `console.error` and the rest of the subscribers run. Before, one throwing prefs subscriber made `store.set` throw, and one throwing image subscriber left the others unaware an image had loaded.
  
  For the font and renderer signals, a subscriber added during a notify now waits for the next one; a prefs store already worked that way.
- 534c866: Adds API: `usePrefsStore(schema, options)` in `@weasel-js/prefs/react`, a store open for as long as the component calling it is mounted. It opens during the first render, from an adapter that reads synchronously, so that render has values, and closes with its queued writes sent on unmount. One store is open per `storage` and `prefix`: components naming the same pair share it, and StrictMode's second mount and a fast refresh get the store already open, never a second writer. A new `schema`, `storage`, or `prefix` closes the store and opens the one asked for; a new `options` object alone does nothing.
- Updated dependencies [09755da]
- Updated dependencies [de319ce]
- Updated dependencies [21b6db7]
- Updated dependencies [1ee5335]
- Updated dependencies [27b827e]
- Updated dependencies [ee08fa5]
- Updated dependencies [38fd203]
- Updated dependencies [9ad34e0]
  - @weasel-js/storage@1.10.0
  - @weasel-js/quantity@1.10.0
  - @weasel-js/registry@1.10.0

## 1.9.4

### Patch Changes

- 9dfd8a5: A leaf may say `absentIsDefault: true`: nothing held where its value is read means its `default`. `SelectionPanel` draws that default for a node with no value at the leaf's path, and no longer reads such a node beside one holding the default as Mixed; nothing is written until an edit, which writes only the value typed. `defaultNodeProperties` sets it on `pose.rotation`, so a node whose pose has no `rotation` shows 0. `aggregateValue` takes the value an empty path reads as, and `PrefSchemaEditor` offers the flag among a leaf's attributes.
- 4c4aa40: An action leaf fires a registered action by key. `PrefAction` gains `action`, the key of an action on the `ActionsRegistry` above the surface: its id, or `id:variant`. A leaf holding one is plain data, so a schema that carries it survives JSON. `run` is now optional and is what a leaf with no `action` calls. The leaf's `name` and `icon` are what the button shows; the registered action supplies the icon and shortcut the leaf lacks. A key the registry does not hold, or no registry, leaves the button dead. `PrefAction` also gains `control`: `'button'` reads the label, `'icon'` is the icon alone.
  
  An action says whether it is held down. `Action` gains `active`, a predicate under the same contract as `enabled`, and `evaluateActive` reads it safely. A button drawn for the action sets `aria-pressed` from it. An action with no `active` has no pressed state.
  
  `useLeafAction` answers for an action leaf on any surface. `BarAction` is the leaf as a toolbar cell, and `BarActionButton` is the button alone. `ActionBar` draws its entries with that button, so it now shows an active action as pressed. `PrefActionButton` draws through the same hook.
- 1bde2a4: A leaf says as data what it does when auto. `PrefBase` gains three optional fields: `manual` (never auto), `unpinned` (starts auto), and `autoValue` (what it reads while auto, which need not be its `default`). labkit already wrote the first two onto its leaves from `.manual()` and `.initial(auto)`; they are now part of the type.
  
  `PrefSchemaEditor` edits all three in a new Auto panel of a leaf's attributes. The auto value starts unset, and its label pins it, starting from the default. A leaf with no value, such as an action, gets no panel.
  
  `PrefsForm` gives a `manual` leaf no auto toggle, whatever `canInherit` says. labkit resolves an auto leaf to its `autoValue` where it has no `.auto()` resolver, and `ControlPanel` quotes that value in the row's ⓘ tooltip as it does a resolver's.
- 07d96b0: A field has a bar form. `BarField` takes the props `PropertyField` takes and draws the field as a cell of a toolbar: a number or a text box behind its name, a flag as a button held down while on, a paint as its swatch, a radio group as segments. `BarPopover` is the cell for what one line cannot hold, a button that opens a popover; a text area draws through it.
  
  `ToolOptionsBar` draws its schema's leaves through `BarField`, which changes three of them. A boolean with no `control` is a toggle button where it was a switch. A paint is a swatch that opens its editor where it was the editor inline. A leaf whose value is made of others (`object`, `list`, `map`, `union`) is a button that opens its rows where it drew them on the line. A string's box is `12ch` wide where it was `5ch`.
  
  An enum takes `control: 'menu'`: a button reading the current value, as wide as that value. `PropertyField` and `PropertyControl` draw it, `PrefEnumControl` allows it, and `PrefSchemaEditor` offers it. `MenuButton` gains `current`, which draws its label as a value and not as a prompt.
- 34feefc: A group can be drawn as a bar. `PrefGroupAs` gains `'bar'`, and `Bar` draws one from a schema: `schema`, `values` keyed by dotted path, `onChange`, `mixed`, and `renderers`, as `ToolOptionsBar` takes them, plus `orientation` and `label`. A leaf is a cell in its bar form. A nested `section`, `bar`, or `fragment`, or a group that says nothing, is a run with a divider on each side and no heading. A nested `page`, `tab`, or `panel` opens from a button reading its name, as rows. A vertical bar has no room beside a field, so every leaf but an action opens from a button.
  
  `Bar` has no frame; the host gives it the strip it sits on. `BarLayout` is the line itself, for a surface with its own values and cells, and `groupBarNodes` reads a group into what it lays out.
  
  A group `as: 'bar'` draws as one line of bar forms, with no heading, in a `PrefsForm` page, in an `object` leaf of a `PrefsForm`, and as a `SelectionPanel` section. A section inside an object leaf in `SelectionPanel`, and labkit's `ControlPanel`, still draw one as a headed block of rows.
  
  `ToolOptionsBar` draws its schema with a `Bar`, so a nested group there is now a run between dividers, or a button for a `page`, `tab`, or `panel`, where its leaves used to join the line unmarked.
  
  The icon set gains `formBar`.
- c2a2a5d: A clearable enum can no longer declare a default: `PrefEnum` with `clearable: true` requires `default: undefined`, so a missing value stays the only stored form of cleared. This is a type error for a schema that declared both; drop the default. The fields every enum leaf carries are exported as `PrefEnumBase`. `PrefSchemaEditor` drops an enum's default when it is made clearable and offers no Default field for one.
- d617bf4: An endless slider end keeps its whole range. `endless` used to turn the end stop itself into infinity, so `min={0} max={5000} step={50} endless="max"` could reach 4,950 and then infinity, never 5,000. It now adds a stop for infinity one `step` beyond the range (a twentieth of the range where there is no step, and one more stop under `spacing: 'even'`, labeled with the display's word for infinity), so the track's own end is that stop and every value from `min` to `max` is still reachable. This reaches `Slider`, the slider `PropertyField` draws, `PrefsForm`, and labkit's `.endless()`.
  
  A stored `Infinity` still reads as infinity. A value stored at the old top stop was stored as `Infinity`, so nothing stored changes meaning. A typed number past the range commits infinity, as before; one within half a step of the end commits the end.
- ed78985: A field of an `object` pref marked `hidden` was drawn by `PrefsForm` whether or not `showHidden` was set. `visiblePrefSubtree` now drops an object leaf's hidden fields, and any section inside it that is left empty, the way it drops hidden leaves from a group; the object leaf itself stays, and a hidden field keeps its stored value when a shown one is edited.
- cce05ca: `label` and `separator` are built-in pref kinds (`PrefLabel`, `PrefSeparator`): leaves that hold no value, so a store skips them and neither is a `PrefPath`. Every params surface now draws them the same way, through `PrefLabelLine` and `PrefRule` from `@weasel-js/ui`: `SelectionPanel` and labkit's `ControlPanel` drew each as an unknown kind before. labkit's builder gains `f.label(text)` and `f.separator()`. `prefFieldChoices` no longer offers either as a field, and `PrefSchemaEditor` offers a label its name, description, and Hidden, and a separator Hidden alone. Code that switches over every `PrefKind` needs an arm for the two.
- b1ecc88: `prefObjectWithField` and `prefObjectBase` in `@weasel-js/prefs` are the one rule for writing a field of an `object` leaf, which `PrefsForm` and `SelectionPanel` each wrote their own way. Where no object is held, the write starts from the scalar lifted by `fromScalar`, else from the leaf's `default`, so the value is whole. `PrefsForm` used to start from an empty object there, and wrote one field on its own.
- 4d559ca: `isPlainObject` lives in `@weasel-js/registry` (core still exports it), and `@weasel-js/geom` exports a scalar `clamp(v, lo, hi)`. theme, prefs, labkit, and forge read plain objects through the one realm-safe test, so a `Date` or a `Map` no longer passes where they accept a record; ui's Slider and ResizeHandle, hud's loupe, and labkit's ZoomControl use geom's clamp. When its bounds cross, ResizeHandle now holds to `min` where it held to `max`. theme and prefs gain a dependency on registry, and ui's on geom moves from dev to runtime.
- 151a441: A new pref kind, `alias`: a leaf that shows another leaf. Its row draws that leaf's control and reads and writes that leaf's value, so one setting can sit on two pages over a single stored value.
  
  ```ts
  play: { name: 'Play', children: { grid: { kind: 'alias', name: '', description: '', default: undefined, of: 'view.grid' } } }
  ```
  
  `of` is the path the shown leaf's value lives at. `name` and `description` left empty are the target's; given, they rename the row at the alias's place only. An alias holds no value: a store neither reads nor writes one, `prefHoldsValue` answers false for it, and its path is not a `PrefPath`. `@weasel-js/prefs` adds `PrefAlias`, `prefAliasTarget` (which follows an alias of an alias and answers nothing for a missing target or a loop), `prefAliasedLeaf`, and `prefLeafAt`.
  
  `PrefsForm` and labkit's `ControlPanel` draw an alias as its target's row; an alias of nothing draws a note saying so, in place. In labkit `f.alias('view.grid')` builds one, and its own `.section`, `.showIf`, `.label`, and `.describe` place and name it. `SelectionPanel` does not draw aliases yet.
  
  `PrefSchemaEditor` lists `alias` among the kinds, with an `Of` picker, and makes one by a drag with Alt and Cmd (or Ctrl) held. Moving or renaming a pref, or a group above it, rewrites the aliases that name it.
  
  This adds a member to `PrefKind`, so a `switch` over a built-in leaf's kind that ends in a `never` guard stops compiling until it handles `alias`.
- a14e734: A `PrefGroup` can say how it is drawn, with `as`: `'page'` (an entry in the form's rail and a pane of its own), `'tab'` (one tab in a strip shared with the `tab` groups beside it), `'panel'` (a bordered, titled box), or `'section'` (a heading over its rows). Unset, depth decides as before: a top-level group is a page and a nested one a section. `PrefsForm`'s rail layout draws all four; a top-level group that is not a page is drawn on the root's own page, with the root's leaves. Its columns and list layouts, and labkit's `ControlPanel`, draw tabs, panels, and sections; they have no pages, so `'page'` draws as the default there. labkit's `f.group(...)` takes `.as(kind)`. `PrefSchemaEditor` sets it from a group's "Drawn as" attribute, and its tree files non-page top-level groups under General.
  
  `prefGroupIsPage` and the `PrefGroupAs` type are exported from `@weasel-js/prefs`.
  
  A `PrefSection` takes `as` too, without `'page'`: `SelectionPanel` draws a run of tab sections as one strip and a panel section in a box, and so do the sections inside an object leaf, in both `SelectionPanel` and `PrefsForm`. `GroupTabs` is the one tab strip all of them use, exported from `@weasel-js/ui`. `PrefSchemaEditor` offers "Drawn as" on a section and a palette of tab, panel, and section for a section schema.
- f6ea86c: `@weasel-js/prefs` exports `PREF_KIND_TRAITS`, one record saying of every built-in kind whether its value is made of other leaves and whether its control is several controls, with `prefIsCompound` and `prefDrawsSeveral` to read it. `PrefsForm`, the bar, and labkit's `ControlPanel` read it in place of their own lists of kind names, so a kind added to `PrefKind` does not compile until it says what it is. labkit's `ControlPanel` now draws `font-family` and `font-weight` leaves with the pickers ui has for them; it said it had no control for them.
- 80eee37: Each stored pref record is stamped with the schema version it was written at: a record is now `{ $at: <version>, value: <value> }` where it was the bare value. Migrations run on each record from its own stamp, so a record this build wrote is no longer migrated a second time when a lower `$version` arrives from an older tab or a restore, and a record an older build leaves is migrated when it arrives, whether its `$version` came before it or after.
  
  This changes what is in storage. The first open by this build rewrites every existing record with a stamp; a record with none is read as being at the store's `$version`. A build from before this change that opens the store afterward reads each stamped record as a value it does not recognize and falls back to that pref's default, so do not run the two against one store. Code that reads pref records out of storage directly unwraps `value`. A migration is handed only the records at its own version, and still sees plain values. `runPrefsMigrations` takes `{ stampAll }` in place of its `only` set, and `createPrefsStore` takes the version it stamps with as a fifth argument.
- 9f70b3c: **Breaking change to the schema types.** A pref schema's branch node was one type, `PrefGroup`, read two ways: the prefs store and `PrefsForm` took a group's key as a path segment, and a node's property schema took it as a heading over leaves whose own keys were whole node paths. There are now two types, and a schema of one is a type error where the other is read.
  
  `PrefGroup` keeps `children` and the nested reading: `view` > `gridDensity` is the leaf at `view.gridDensity`. The new `PrefSection` holds `members`, and its key adds nothing to a path. `NodePropertiesEntry.schema` is a `PrefSection`, and so is a heading inside a `PrefObject`'s `children`.
  
  What to rewrite:
  
  - A node property schema passed to `createNodeProperties().register`, `<SceneCanvas>`, or `<SelectionPanel>`: rename `children` to `members` on the root and on every group inside it. An `object` leaf keeps `children`.
  - A group nested inside an `object` leaf's `children`, in any schema: rename its `children` to `members`.
  - Code that walks a node property schema reads `.members`. `prefSectionLeaves(members)` returns every leaf under a section's `members` or an object leaf's `children` by its own key, and `isPrefSection` tells a section from a group.
  - `prefFieldChoices(schema)` no longer takes a second argument. It reads the path rule off the schema it is given, so pass a `PrefSection` where `false` was passed.
  - `SelectionPanel`'s `isGroup` is gone; use `isPrefLeaf`.
  
  A preferences schema and a tool's `options` are unchanged unless they nest a group inside an `object` leaf.
  
  `PrefSchemaEditor` edits the sections inside an `object` leaf: it adds one where it used to add a group, prints it with `members`, and refuses to move a group under an object leaf or a section out from under one.
- 047dcf3: Types declared in code, placed by `PrefSchemaEditor`.
  
  `prefType(name, leaf)` in `@weasel-js/prefs` returns the leaf with `name` in a new optional `type` field on `PrefBase`. The store, repair, and the forms treat it as the leaf it is; a use site spreads it under what it sets (`{ ...GradientStop, name: 'First stop' }`) or passes it as a list's or a map's `item`.
  
  `PrefSchemaEditor` takes `types`, an array of such leaves (`PrefTypes`):
  
  - The kind picker, in the attributes pane and in Add pref, offers each type by name beside the kinds.
  - A leaf made from a type is one row in the structure tree. Its attributes are what its use sets: key, name, description, default, and the shared flags. The default is drawn by the type's own control.
  - The literal prints the type's name: `first: { ...GradientStop, name: 'First stop' }`, or the bare `GradientStop` where nothing is set over it. The reader imports the name where the literal is pasted.
  - A draft holds a typed leaf as the type's name and what the leaf sets, so code inside a type survives a reload for a leaf the source schema never held. A draft naming a type no longer in `types` opens with that leaf under the type's name, marked "(not registered)" in the kind picker.
  
  Breaking, in the editor's tree: a list's or a map's `item` and a union's variants are no longer rows.
  
  - A list or a map is one row. Its entry is edited in the list's own attributes, under Entry: a picker of the kinds one control edits (`number`, `boolean`, `string`, `enum`, `color`, `paint`, `field`) and the registered types, then the entry's name, its default, and a plain kind's own attributes. A list of lists or of objects needs a type.
  - A union is one row and is no longer offered as a kind for a new pref; its variants come from a type. One already in a schema stays, and prints its literal as before.
  - An `object` leaf with no type keeps its editable children.
  - A change to an entry is reported under the list, as `phases.item.default`, where it was `phases/item.default`.
  - `printSchema(root, types?)` takes the types to print by name.
  
  Also: an `object` leaf's fields no longer run past the edge of a narrow form. The nested control slot kept a 110px minimum inside a column that could be narrower.
- 3baab83: A filter matches an alias as the row it draws. `filterPrefSubtree` reads an alias with no name or description of its own by its target's, so a `PrefsForm` query that finds a pref also finds the unnamed aliases of it; before, those rows dropped out. The function takes a fourth argument, `leafAt`, for finding a target outside the subtree being filtered, which `PrefsForm` passes so an alias of a hidden pref still matches.
- 0c1edcb: A group or a section can be drawn `as: 'fragment'`: nothing of its own, so its rows sit among its neighbors' as though they were written there. It is for holding things together and no more: one key for their values to nest under, and one node to select, move or copy. It gets no heading, box, tab or rail entry, and at the top level its rows go on the root's own page. In a form two rows across, its rows take cells in the same grid as the rows around it.
  
  `PrefsForm`, `SelectionPanel`, an `object` leaf's sections, and labkit's `ControlPanel` all draw it that way. Selected, it marks the rows it holds, having no box of its own to mark. `PrefSchemaEditor`'s palette makes one with a new Group tool, under the `</>` glyph, and the "Drawn as" choice lists it.
  
  A group nested inside a fragment is drawn where the fragment is, as a section unless it says otherwise; it gets no rail entry of its own.
- 7e05174: An endless number inside an `object` or `union` leaf keeps its infinity on JSON storage. `store.set` wrote the infinity as a string only for a bare number, a list, or a map, so `{ cap: Infinity }` reached localStorage as `{"cap":null}` and read back as the field's default after a reload. A list or map of objects had the same hole.
- 27818ca: Four new built-in pref kinds: `list`, `map`, `union`, and `action`.
  
  A `list` leaf holds an array whose entries are each described by `item`, an ordinary leaf: `{ kind: 'list', item: { kind: 'number', min: 0 }, minItems: 3, maxItems: 3 }`. The item may be any kind, built-in or app-defined, including an `object` or another `list`. A stored list reads entry by entry through the item, so one bad entry falls back to the item's default and the rest are kept; a list shorter than `minItems` reads as the default and one longer than `maxItems` is cut to it. `PrefValueOf` types a list by what its item holds.
  
  A `map` leaf holds a record keyed by strings nobody declared, every value described by `item` as a list's entries are: `{ kind: 'map', item: { kind: 'number' } }` types as `Record<string, number>`.
  
  A `union` leaf holds one of several object shapes, told apart by the string in its `tag` field. Each variant is an `object` leaf keyed by its tag value: `{ kind: 'union', tag: 'type', variants: { linear: {…}, radial: {…} } }` holds `{ type: 'linear', angle: 90 }`. Choosing a variant sets the value to that variant's default under its tag. A stored value whose tag names no variant reads as the default. `prefVariantOf` and `prefVariantDefault` are the two lookups. `PrefValueOf` types a union as each variant's fields under its tag, where the schema keeps `tag` a literal (`tag: 'type' as const`); with `tag` widened to `string` it is typed by its `default`, as before.
  
  `repairPrefValue` now reads inside an `object` leaf: each field the stored object holds is read as its own leaf would be, so a number field is clamped and an enum field with an unknown option falls back to that field's default. A field the object omits stays omitted, and fields no leaf describes pass through. It used to accept any plain object whole. A union's variant and an object entry of a list or a map are read the same way.
  
  An `action` leaf holds no value: it is a button among the rows that calls `run({ path })`, disabled while a promise `run` returned is pending. A store skips it, and its path is not a `PrefPath`. `prefHoldsValue(leaf)` tells the two sorts of leaf apart.
  
  `PrefsForm`, `SelectionPanel`, and labkit's `ControlPanel` draw all four. A list is a `ListEditor` with one control per entry, drawn as the item leaf would be on a row of its own, and an entry of an app-defined kind goes to that kind's renderer. In `PrefsForm`, a list whose entries are objects or lists puts its label above the entries, which need the row's whole width. `PrefsForm` now does the same for a field of an `object` leaf, which used to show "no renderer" for an app-defined kind whether or not one was registered. `ListEditor` takes entries of any type through `renderEntry` and `newEntry`, and stops at `minItems` and `maxItems`. `PrefActionButton` is the action's button, exported for surfaces that draw their own rows. `MapEditor` draws a map as a key field and the item's control per entry, and `UnionPicker` a union as a select over the chosen variant's fields; both stack under the row's label.
  
  `PrefControl` is one leaf's control as `PrefsForm` draws it, without the row: for a surface that lays out its own rows and has an object, a list, a map, or a union to put in one.
  
  labkit: `f.list(default, item)` builds a typed list (`f.list([0, 1], f.number(0).range(0, 9))`), `.count(min, max)` bounds it, and `f.action(run)` builds a button. `f.list(strings)` is unchanged. An `f.value` whose default is an array of numbers or booleans is now inferred as a list of them; it used to throw. `f.object(fields)` builds one value with named fields (where `f.group` makes each field a leaf of its own), `f.map(default, item)` a record by arbitrary key, and `f.union(tag, variants)` one of several objects; each infers its config type. `ControlPanel` opens an object, a map, a union, and a list of anything but plain strings in a dialog from its row, drawn by `PrefControl`. An object leaf used to show "no control for object".
  
  `PrefSchemaEditor` shows a list's or a map's `item` as a row under it in the structure tree, edited in the attributes pane like any leaf; it has no key to rename and cannot be removed or moved. A union's variants are rows under it: adding to a union adds an `object` leaf, and renaming a variant's key renames it in the union's default. A new action exports with `run: () => {}`, a stub to fill in, where it used to export `KEEP_FROM_SOURCE` with nothing in the source to keep.
  
  **Breaking for anyone who registered a custom kind named `list`, `map`, `union`, or `action`:** those names are built-in now, and a `list` leaf needs an `item`. labkit's own `f.list` leaves carry one.
- 2cc1b5a: Prefs migrate records that arrive after the open. When another writer leaves an older `$version`, as an older build open in a second tab does, the store runs its migrations from that version over the records other writers changed and persists the result; before, it ran on the older-shape records for the rest of the session. Records a failed first read delivers late are migrated the same way, and a value set before they arrived is left as it was set. `runPrefsMigrations` takes a third argument, the names to migrate, for that. Another writer deleting `$version` is read as a cleared store, and migrates nothing.
  
  Breaking for a caller of `watchPrefsVersion`: it takes the migrations, `watchPrefsVersion(cache, migrations)`, where it took their count.
  
  `OwnedRecordCache` gains `onOverruled(listener)`, which reports another writer's changes the cache did not take because its own write to the record was queued or on its way. The prefs version watch listens there too, so a newer build's `$version` still stops this build persisting when it lands during this build's own write of that record.
- 3edffaf: Pref paths no longer walk the prototype chain. A schema group keyed `constructor` made `createPrefsStore` write its leaves onto the global `Object` (and throw from every read when a leaf was keyed `name`), a key or stored record named `__proto__` replaced a prototype instead of setting a value, and `prefValueAtPath` returned an inherited function for a path like `toString`, so `flattenPrefValues` reported values a tree never held. `prefValueAtPath` and `assignPrefValueAtPath` now read and write own properties only, and so do `store.values()` and `store.stored()`.
- 812118e: New `@weasel-js/storage` package: the storage adapters and `RecordCache` that lived in labkit, split into one module per adapter. localStorage, sessionStorage, memory, and the no-op adapter gain `listSync`, and `openRecordsSync` opens a record cache over them without awaiting. `fallbackStorage(preferred, fallback, label)` wraps an adapter with a fallback for when it is unavailable, and `createDefaultStorage(preferred, label)` builds a page-wide default from one: `preferred`, or localStorage where it will not open, chosen once. Storage's own `indexedDbAdapter` and `defaultStorage` use the IndexedDB database `'weasel'`. `RecordCache.flush()` now resolves `true` when every queued write landed and `false` otherwise; it used to resolve to nothing. labkit re-exports the adapters, and its `indexedDbAdapter` and default storage stay on the database `'labkit'`, where every existing lab's records are.
  
  New `@weasel-js/prefs` package: the preferences schema, moved out of core, and a store for it. `openPrefs` and `openPrefsSync` keep one record per leaf and repair values against the schema on read. `store.stored()` returns the raw stored records as a tree, orphans included, and `usePrefsValues` returns it as `stored`. Versioned migrations run on open: a malformed `$version` opens the store read-only, and a newer `$version` written by another writer stops this store from persisting. `Infinity` and `-Infinity` on number leaves are stored as the strings `'Infinity'` and `'-Infinity'`. `PrefsStore.flush()` resolves a boolean, with the same meaning as `RecordCache.flush()`. The `usePref` and `usePrefsValues` hooks, imported from `@weasel-js/prefs/react`, produce the values `PrefsForm` takes; the main entry loads no React.
  
  Breaking: the schema types are renamed from `ToolPref*` to `Pref*` (`ToolPref` itself is `BuiltinPref`, `TOOL_PREF_KINDS` is `PREF_KINDS`, `isBuiltinToolPref` is `isBuiltinPref`) and are imported from `@weasel-js/prefs`. Neither core, ui, nor `@weasel-js/labkit/weasel-ui` re-exports them, nor ui's `isPrefLeaf`, `prefValueAtPath`, `visiblePrefSubtree`, `filterPrefSubtree`, or `prefDisplayBounds`. labkit's cross-tab BroadcastChannel is renamed, so tabs on an older and a newer labkit stop hearing each other until both reload.
- 9de4985: A record cache whose first read fails now recovers. This changes behavior: `openRecords` and `openRecordsSync` used to answer a failed read with a cache that stayed empty and read-only until the page reloaded. It now reads again on a backoff, starting at `retryMs` (default 1000 ms) and doubling to `retryMaxMs` (default 30000 ms), and `cache.read()` tries at once. When a read lands, the cache holds the records, reports them to listeners as one batch of `remote` changes, hears other writers, and turns `writable` on. Records set or deleted while it waited win over what was read and are then written, and a delete made while unread is now queued even though the cache holds no such record. `retryMs: false` keeps the old behavior, and a cache its opener stopped with `stopWriting()` stays read-only and stops retrying. `RecordCache` gains the `read()` method, which anything implementing the interface by hand must add.
  
  A prefs store opened while its storage was away therefore shows the stored values and starts persisting once the read lands. `PrefsStore` gains `read()` to try at once, `writable` turns true when it does, and a store with migrations now also stops persisting when the records that arrive late carry a version newer than the build knows. Migrations are not rerun over records that arrive late.
  
  labkit's lab store opens its records with `retryMs: false`, so a lab whose storage could not be read stays empty and unsaved for the session, as before. `<Persistence>` uses the default and recovers.
- 72a40c5: Setting a record to `undefined` deletes it. `RecordCache.set(name, undefined)` used to hold the record as present while telling listeners it was deleted, and each adapter then did something different: localStorage stored the text `undefined`, which read back as a string, and IndexedDB stored a record other tabs heard as a delete. Through `PrefsStore.set`, clearing a clearable enum in a prefs form left the leaf counted as set, with that stray record behind it. It now unsets the leaf.
- a66fcf5: `RecordCache.whenRead()` and `PrefsStore.whenRead()` resolve once storage has been read: at once for one that opened with its records, and when a later read lands for one whose first read failed. Work an opener does once at open can rerun there.
  
  Prefs use it to record `$version` when a late first read finds nothing stored; before, values set while storage was away were persisted with no version, and the next open migrated them from 0. A `$version` another writer deletes, as clearing the store does, is written back for the same reason.
- a14e734: `PrefSchemaEditor` lays a schema out by dragging. A node dragged from the structure tree can be dropped in the live preview: beside a row, into a group, or onto a rail entry, which opens that page when the drag rests on it. A palette under the toolbar holds chips for a new page, tab, panel, section, and label, each dragged into the tree or the preview. The preview draws empty groups, so a new one is somewhere to drop into.
  
  `PrefsForm` draws a leaf of kind `label` as text among its rows: the leaf's name, with its description under it. Nothing is stored for it. `PrefsForm` also takes `dropMark`, to mark where a drag would land, and `showEmpty`, to draw groups with no leaves; `prefDropTargetAt` finds a drop mark from a pointer position. `visiblePrefSubtree` takes `keepEmpty`.
  
  `Tree` takes `onDragOutside` and `onDropOutside`, so a drag begun in it can end somewhere else, and `externalDrag` with `onExternalTarget`, so a drag begun somewhere else can land in it.
- Updated dependencies [001aaae]
- Updated dependencies [e437227]
- Updated dependencies [c19221d]
- Updated dependencies [4d559ca]
- Updated dependencies [2cc1b5a]
- Updated dependencies [812118e]
- Updated dependencies [7905beb]
- Updated dependencies [afbc295]
- Updated dependencies [9a6f7a5]
- Updated dependencies [7908e8f]
- Updated dependencies [d113843]
- Updated dependencies [9de4985]
- Updated dependencies [b23225f]
- Updated dependencies [72a40c5]
- Updated dependencies [a66fcf5]
- Updated dependencies [b18c036]
  - @weasel-js/registry@1.9.4
  - @weasel-js/storage@1.9.4
  - @weasel-js/quantity@1.9.4
