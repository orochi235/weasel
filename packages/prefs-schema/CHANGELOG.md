# @weasel-js/prefs-schema

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
- 15e923d: `PrefGrade` is removed: an action leaf's `grade` is `Grade` from @weasel-js/registry, the same type theme and ui use.
  
  ```ts
  import type { Grade } from '@weasel-js/registry'; // was: import type { PrefGrade } from '@weasel-js/prefs'
  ```
  
  <!-- entry: breaking -->
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

- 4c8749c: A condition test can read its path from the group its node is declared in, so a settings group mounts anywhere.
  
  ```ts
  axis: pref.enum('Axis', 'x', ['x', 'y'], { enableIf: { from: 'group', path: 'on' } }), // reads <group>.on
  ```
  
  `applyPrefConditions`, `prefStatusAt`, `checkPrefConditions`, settings menus and labkit's `configFromPrefs` resolve these tests themselves. Code that evaluates a schema's conditions any other way resolves them first with `resolvePrefGroupConditions(schema)`, or `prefConditionInGroup(condition, group)` for one condition; one that reaches a reader unresolved warns. `checkPrefCondition` checks one against `site.group`, which the schema editor's marks and `PrefConditionEditor`'s new `group` prop supply (`conditionGroupAt` finds it).
  
  <!-- entry: api -->
- 5477214: New package `@weasel-js/prefs-schema`: the pref builders and leaf, group and section types, without the prefs store
  
  It holds the declaration half of `@weasel-js/prefs`: `pref`, `PrefGroup`, `PrefSection`, `PrefLeaf` and the other leaf kinds, units (`prefUnit`, `PX_UNIT`), conditions and leaf status, `repairPrefValue`, and `PresetDescription`. It depends on icons, paint, quantity and registry only, with no store, no storage and no React. A package that declares settings and leaves storing them to its host depends on this one:
  
  ```ts
  import { pref, type PrefGroup } from '@weasel-js/prefs-schema';
  ```
  
  <!-- entry: new api -->
- 7e5b389: A schema's path and value types are exported from `@weasel-js/prefs-schema`, so code declaring a schema needs no store.
  
  That is `PrefPath`, `PrefAtPath`, `PrefValueAt`, `PrefValueOf` and `PrefFieldsOf`; `@weasel-js/prefs` still exports them too.
  
  <!-- entry: api -->
- 7e5b389: `PrefValuesOf<typeof group>` types the values a prefs group holds, so options can be typed from the schema that draws them.
  
  ```ts
  const grid = pref.group('Grid', { visible: pref.boolean('Shown', true), pitch: pref.number('Pitch', 8) });
  type GridValues = PrefValuesOf<typeof grid>; // { visible: boolean; pitch: number }
  ```
  
  <!-- entry: rank=10 new api -->
- 371b695: `usePrefGroup(store, path)` reads one prefs group as an object of its values, and writes the leaves a patch names.
  
  Its paths are typed by `PrefGroupPath`, and its value by `PrefValuesOf<PrefGroupAt<S, P>>`.
  
  <!-- entry: rank=5 api -->

### Patch Changes

- 2823dca: `PrefValuesOf` types a `clearable: true` number leaf as `number | undefined`, the value it holds once cleared. `pref.number` returns a leaf that is not clearable, so its value stays `number`.
  
  <!-- entry: fix -->
- a3b1735: `prefDisplayBounds` swaps the ends of a decreasing unit whose `places` round one stored unit to zero, so its min stays below its max.
  
  <!-- entry: fix -->
- bcc5c05: `nestPrefValues` no longer throws when a deeper path runs through a shorter one holding a number or string: the later entry wins.
  
  <!-- entry: fix -->
- e11a52e: Editing one field of an `object` leaf that holds nothing starts from the leaf's `default`, even when the leaf has `fromScalar`.
  
  <!-- entry: fix -->
- 3744131: Pref selectors, object fields and validator kinds named like `constructor` or `toString` read as absent, not as `Object.prototype` members.
  
  `weighScope`, `prefScopeValue` and `writeDeclared` treat such a selector as one the weights or selection leave out, `prefObjectField` returns `undefined` for such a field, and `repairPrefValue` runs no validator for such a kind.
  
  <!-- entry: fix -->
- 2e7bd80: `prefReader` over a section reads an unset path from the member keyed by the whole path, ahead of a member whose key only begins it.
  
  <!-- entry: fix -->
- 6c3e486: `repairPrefValue` repairs a dotted field of an `object` leaf (a stroke's `nib.angle`) where it is stored nested, as `{ nib: { angle } }`.
  
  <!-- entry: fix -->
- 7affd45: `prefStatusAt` answers a dotted object field (a stroke's `nib.angle`) by its own conditions, not those of a sibling keyed `nib`.
  
  <!-- entry: fix -->
- 470d4be: A condition reading a union's field decodes it by the variant held, even where another variant holds a list at that key.
  
  <!-- entry: fix -->
- Updated dependencies [5f856dc]
- Updated dependencies [84028cb]
- Updated dependencies [6cef61c]
- Updated dependencies [fcc5602]
- Updated dependencies [bfc26b4]
- Updated dependencies [935346c]
- Updated dependencies [27eb7f9]
- Updated dependencies [754e0c6]
- Updated dependencies [aedb49f]
- Updated dependencies [8257aa7]
- Updated dependencies [2338cee]
- Updated dependencies [158f868]
- Updated dependencies [ffcde61]
- Updated dependencies [19f8e39]
- Updated dependencies [c57e67c]
- Updated dependencies [201d32f]
- Updated dependencies [8e43f3f]
- Updated dependencies [5ffc43b]
- Updated dependencies [813a306]
- Updated dependencies [e0f4c91]
- Updated dependencies [df2ae04]
- Updated dependencies [8882b53]
- Updated dependencies [174d6ef]
- Updated dependencies [e6871f1]
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
- Updated dependencies [73f549e]
- Updated dependencies [73f549e]
- Updated dependencies [a13982c]
- Updated dependencies [52ee422]
- Updated dependencies [73f549e]
- Updated dependencies [4bcea5f]
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
- Updated dependencies [8fb09ad]
- Updated dependencies [ba7e062]
- Updated dependencies [5202a9f]
  - @weasel-js/quantity@2.0.0
  - @weasel-js/registry@2.0.0
  - @weasel-js/paint@2.0.0
  - @weasel-js/icons@2.0.0
