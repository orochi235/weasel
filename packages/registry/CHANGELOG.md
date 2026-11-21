# @weasel-js/registry

## 2.0.0

### Minor Changes

- aedb49f: `createExtensionRegistry` makes a registry whose conflicts throw unless the call asks to replace, and which can fall back to a parent.
  
  The same value again is no change, a different one throws `ExtensionConflictError` unless the call passes `replace: true`, and each registration returns its release. Op factories and shader sources are built on it. Core re-exports it.
  
  ```ts
  const shared = createExtensionRegistry<Widget>({ kind: 'widget' });
  const mine = createExtensionRegistry<Widget>({ kind: 'widget', parent: shared });
  const release = mine.register('dial', dial);
  mine.register('dial', other);                    // throws ExtensionConflictError
  mine.register('dial', other, { replace: true }); // replaces; `release` now does nothing
  ```
  
  <!-- entry: rank=5 new api -->
- 2338cee: `getOwn` takes a record that may be `undefined` or `null`, and reads nothing from it.
  
  ```ts
  getOwn(opts.labels, key); // was: opts.labels && getOwn(opts.labels, key)
  ```
  
  <!-- entry: api -->
- 174d6ef: `isOneChar` moved from `@weasel-js/ui-input` to `@weasel-js/registry`, beside `codePointFloor`; it is unchanged.
  
  ```ts
  // before
  import { isOneChar } from '@weasel-js/ui-input';
  // after
  import { isOneChar } from '@weasel-js/registry';
  ```
  
  <!-- entry: breaking api -->
- 73f549e: A key released and registered again in the same tick can keep its place in a registry's order, with `createReflectable({ holdPlace: true })`.
  
  With `holdPlace`, a key whose last registrant is released keeps its place in `entries()` until the current microtasks have run, reading as absent meanwhile, so a React effect that releases and re-registers when its value changes leaves the key where it was.
  
  <!-- entry: api -->
- 73f549e: A registry whose registrants are meant to stack can opt out of the clash warning with `createReflectable({ layered: true })`.
  
  In a layered store every push over a live registrant is an override, so none draws the development clash warning. Use it where stacking is the registry's contract, as with a source that composes over the one beneath it; elsewhere, mark the default with `fallback` or push the override at a higher `rank`.
  
  <!-- entry: api -->
- a13982c: `createReflectable`'s `push` takes a `rank`, its `set` returns a release, and its new `batch` announces several changes as one.
  
  A registrant pushed with `rank` stacks under every higher-ranked one, so an override tier stays live over registrants that arrive after it; the reflection reports each registrant's `rank`. The release `set` returns removes that registrant and does nothing once a later `set` replaced it. `batch(fn)` runs `fn` and announces what it changed as one version step and one notification.
  
  ```ts
  store.push('app:save', glyph, { rank: 1, source: 'override' });
  const release = store.set(runId, handle);
  store.batch(() => { for (const [k, v] of rows) store.push(k, v); });
  ```
  
  <!-- entry: api -->
- 73f549e: A `createReflectable` store reads one key's whole stack of registrants with `stack(key)`.
  
  `stack(key)` returns the key's registrants live last, the order `entries()` reports as `shadowed` then `live`, without building the store's entries. The array is frozen and stays the same object until that key changes; a key holding none gives an empty array.
  
  <!-- entry: api -->
- 4bcea5f: `createValuesReader(reflection)` returns a reader of a reflection's live values in key order, the same frozen array until its entries change.
  
  <!-- entry: api -->
- eb8fe62: `codePointFloor(s, at)` gives the longest cut of `s` at most `at` UTF-16 units long that keeps every code point whole.
  
  <!-- entry: api -->
- e9613f8: `compositeKey(parts)` builds one string key for a tuple of parts that no other tuple shares, whatever separators the parts hold.
  
  <!-- entry: api -->
- f004638: `createLatest` hands out tickets for async work, so an answer overtaken by a newer request can be dropped.
  
  `take()` returns a check that holds while its request is the newest; `drop()` retires every ticket out, for an owner that has gone or an answer that arrived another way.
  
  <!-- entry: api -->
- 52d9d64: `createPart(make)` returns a reader that gives each owner one part, made on its first read and held weakly with the owner.
  
  ```ts
  export const transportHoldOf = createPart((clock: TrialClock) => createTransportHold(clock));
  ```
  
  <!-- entry: api -->
- e3c67e9: New `createValueStore(initial, equal?)`: a store of one value that notifies only when a write changes it.
  
  `equal` is `Object.is` by default; pass `sameList` or `deepEqual` for a value rebuilt on every write. Core's measurement cells (`MeasureCell`) are built on it.
  
  <!-- entry: api -->
- 34090f0: `createWarnOnce(cap?)` gives a development-only `console.warn` that says each message once, remembering the last `cap` messages (256 by default).
  
  <!-- entry: rank=-5 api -->
- 03b9392: `@weasel-js/registry` exports `getOwn` and `hasOwnKey`, which read and test a key among an object's own keys only.
  
  A key named `constructor` or `toString` reads as absent, where `table[key]` and `key in table` find `Object.prototype`'s member.
  
  <!-- entry: api -->
- 15e923d: New `GRADES` and `Grade`: the grades a notice, a menu row, an action or a control's tint takes, declared once for every package.
  
  <!-- entry: api -->
- 5962dc2: `identityKeyOf(v)` names any value for a cache or memo key: a primitive by its type and value, an object or function by its identity.
  
  <!-- entry: api -->
- 5dae54d: `isFiniteNumber(value)` says whether a value is a finite number, and narrows it to `number` where `Number.isFinite` does not.
  
  ```ts
  import { isFiniteNumber } from '@weasel-js/registry';
  
  const zoom = isFiniteNumber(stored.zoom) ? stored.zoom : 1;
  ```
  
  <!-- entry: api -->
- 0208a3b: `createKeyedEmitter` files listeners by key with `createEmitter`'s semantics, and forgets a key once its last listener leaves.
  
  `subscribe(key, fn)` returns the unsubscribe, `emit(key, ...args)` calls the key's listeners, and `clear(key)` drops them all; an unsubscribe called twice or after a `clear` never removes a later subscription.
  
  <!-- entry: api -->
- bb7bb11: `LONGEST_TIMER_MS` is the longest delay one `setTimeout` or `setInterval` keeps, 2^31 − 1 ms, for capping a computed delay.
  
  <!-- entry: rank=-5 api -->
- ee1de44: A registry warns in development when a second registrant claims a taken id, unless the first is an engine default marked with `fallback`.
  
  `push(key, value, { fallback: true })` marks a registrant as a default meant to be replaced. Pushing over a registrant of the same rank that is not a fallback logs one `console.warn` per clash, naming the key and both `source`s; pushing over a fallback, or at a higher `rank`, stays silent, and so does `set`. Registering, releasing and registering again, as StrictMode and HMR do, is not a clash. Every `Registrant` and `ReflectedEntry` reports `fallback: true` when it was pushed as one, and an entry now carries its live registrant's `rank` too.
  
  `createReflectable({ name })` names a registry: its reflection reports `name`, and the warning leads with it (`weasel paint kinds: …`), so two registries clashing on one id are told apart. Every kit registry is named, and an extension registry takes its `kind` as its name.
  
  <!-- entry: rank=10 new api behavior -->
- 5202a9f: `escapeAttr` and `escapeText` move from `@weasel-js/svg` to `@weasel-js/registry`, with `holdsNonXmlChar` beside them.
  
  This is breaking: import them from `@weasel-js/registry`. They escape the same.
  
  <!-- entry: breaking api -->

### Patch Changes

- 84028cb: The development clash warning no longer says the newer registrant is live when a higher-ranked registrant above it still is.
  
  <!-- entry: fix -->
- 27eb7f9: A child extension registry's `entries()` lists its ids and its parent's in the order each was first registered.
  
  <!-- entry: fix -->
- 754e0c6: Ending a subscription to an extension registry no longer ends the same listener's own subscription to its parent or to its `own` reflection.
  
  <!-- entry: fix -->
- 8882b53: `identityKeyOf` gives each symbol a key of its own, so two symbols with the same description no longer share a memo or conflict key.
  
  <!-- entry: fix -->
- e6871f1: A keyed emitter's `clear(key)` called from a listener stops that emit from calling the key's listeners that have not had their turn yet.
  
  <!-- entry: fix -->
- 52ee422: A reflectable's `set` keeps the rank of the registrant it replaces, so a later lower-rank `push` no longer goes live over a higher-rank one.
  
  <!-- entry: fix -->

## 1.19.1

### Minor Changes

- 8562ebe: `foldText` exports the fold `matchQuery` reads text through: lowercased, composed, and with final sigma read as `σ`.
  
  <!-- entry: api -->

## 1.19.0

### Patch Changes

- b1309b2: `@weasel-js/registry` adds `after(ms, fn)`, a timer that waits out any delay. That includes one past the 2³¹ − 1 ms a single timer holds. D3 transition delays use it, and `@weasel-js/editor` and `@weasel-js/d3` now depend on `@weasel-js/registry`.
  
  <!-- entry: new api -->
- 1077865: `deepEqual` reads an array hole as `undefined`, so `[, 1]` no longer equals `[5, 1]`.
  
  <!-- entry: rank=-5 fix -->
- b1309b2: Under `undefinedAsAbsent`, `deepEqual` compares only a key's own value, never an inherited member of the same name. So `{ __proto__: {} }` (as `JSON.parse` builds it) no longer equals `{}`, and `{ constructor: undefined }` now does.
  
  <!-- entry: rank=-5 fix -->
- b1309b2: Calling a `createEmitter` unsubscribe again after its listener subscribed anew no longer removes the new subscription.
  
  <!-- entry: fix -->
- 1077865: A `createEmitter` listener unsubscribed and resubscribed during an emit waits for the next emit, like any listener subscribing during one.
  
  <!-- entry: rank=-5 fix -->
- 1077865: `freshId` no longer hangs when `from` is past 2^53 and its first id is taken. Counting past the largest number throws a `RangeError`.
  
  <!-- entry: rank=-5 fix -->
- 2bf3397: `matchQuery` matches text however its accents are encoded, so `é` finds an `e` plus a combining acute (as macOS file names spell it).
  
  <!-- entry: fix -->
- 1077865: `matchQuery` matches a Greek capital sigma at the end of a word, where it lowercases to `ς`, as well as inside one.
  
  <!-- entry: rank=-5 fix -->
- 1077865: `isPlainObject` and `isPlainPrototype` no longer take an object whose prototype is a bare `Object.create(null)` for another realm's plain object. `deepEqual` and everything else that asks follow, and `@weasel-js/storage`'s JSON adapters no longer warn about a foreign object carrying `Symbol.toStringTag`.
  
  <!-- entry: rank=-5 fix -->
- b1309b2: `@weasel-js/registry` exports `setOwn`, which sets a key as an own property.
  
  Prefs' `setOwnPrefValue` and labkit's `setOwn` run through it.
  
  <!-- entry: api -->

## 1.18.2

### Patch Changes

- b188aea: Fixes to the last operation, tunings, held previews, merged menus, tool options, scratch keys, `freshId`, cursor sizes and the scoping dim.
  
  - Adjusting the last operation after its action was unregistered, or while its `enabled` refuses, leaves the operation, the history and the selection as they were, and `adjust` returns `false`. Before, it undid the operation and put nothing in its place.
  - A tuning's params reach an action that declares a `params` form as the registry lists it, so `invokedParams` names them and a variant's shortcut chip shows for a binding that fires the variant through the tuning.
  - A held tool option that is NaN or infinite reads as its default, so the bracket keys step it again instead of leaving it NaN. An option named like an `Object.prototype` member (`toString`) reads its default.
  - `getScratch` reads a key named like an `Object.prototype` member as unset until it is written, instead of handing back the prototype's function.
  - A cursor glyph whose `size` or `worldRadius` is NaN, infinite, zero or negative draws at the default size, instead of baking `NaN` into its image, which the browser drops.
  - `createScopingDim` holds `dimAlpha` to [0, 1] and reads NaN as `OUT_OF_SCOPE_ALPHA`.
  - An action held through `holdPreview` asks its `enabled` again at the release, and runs nothing when it now refuses; the preview still comes down.
  - `freshId` numbers from 1 when `from` is NaN or infinite. Before, a NaN `from` looped forever when `base-NaN` was taken.
  - Two menu contributions sharing a key no longer overwrite a key already spelled `key~n`: the second takes the next free `~n`.

## 1.18.1

No changes in this release.

## 1.18.0

### Patch Changes

- b93c1dd: Fixes from an audit of ui-logic, editor and the icon packages, and one definition each for decisions several packages answered separately:
  
  - The icons plugin reads the namespace of an `icons.gen` compiled to JavaScript, so its `icon()` calls are rewritten as a TypeScript one's are.
  - Releasing an icon table a second time no longer bumps the registry's version and notifies its subscribers.
  - `envPx` reads a token set to a bare `0` as 0px, as CSS does, instead of using its fallback or throwing.
  - New in geom: `trimNumber(n, places = 6)`, which pathToD, svg and the renderer's mesh writer now share. The mesh writer kept four decimal places where its comment said it matched svg's six; it now writes six.
  - New in geom: `rectBetween(ax, ay, bx, by)`, the rect two corners span, used by core's drag rect, marquee, area select, anchor marquee, insert extent, measurement and parallax, and by diagram's segment boxes.
  - New in registry: `freshId(base, taken, opts)`, the first free numbered id, used by core's `nextPageId`, diagram's stage, wire, group and sequence ids, and labkit's snapshot names.
  - paint exports `byteHex` and `lerpHueDeg`. core's `withAlpha01` and p-touch's lbx colors write hex through the first. theme's ramps blend hues through the second, so two anchors exactly opposite now blend the positive way round, as CSS's `shorter` does, where before they went the negative way.
  - gestures' `matchKey` takes a readonly key list, and routing's key bindings match through it.
  - ui-logic's `clampTo` is now geom's `clamp` under another name, and is deprecated.

## 1.17.3

No changes in this release.

## 1.17.2

No changes in this release.

## 1.17.1

No changes in this release.

## 1.17.0

No changes in this release.

## 1.16.2

No changes in this release.

## 1.16.1

### Patch Changes

- 25a1ff7: A bare scene call allocates less: it opens its edit mode and pose-write label without building closures, `history.apply` keeps the one-op array it builds rather than copying it, a history push builds its step only when something observes steps, an emitter reuses its listener array until the listeners change, and the pose-write log skips its flush when nothing is pending. `scene.setPose` takes about 10 ns less, 0.24 µs on an M3 Max (9 interleaved runs). Nothing observable changes; `history.applyOps` still copies the array it is handed.

## 1.16.0

No changes in this release.

## 1.15.2

### Patch Changes

- f1906a8: The rest of the kit's stores notify through registry's `createEmitter`: the entered group, the snap
  outcome, devtools roots and transports, kit settings, the menu host and menu controller, tool
  options, `RunSlots`, the seam preview, the HUD list, the effect runners, the symmetry controller,
  the devtools client, and forge's loupe and CSS-variable stores. A listener that throws is logged
  and no longer stops the others, and a listener unsubscribed mid-notify is no longer called; the
  menu host, `RunSlots` and the HUD list used to walk their live set. diagram, diagram-formats, menu,
  symmetry and devtools now depend on `@weasel-js/registry`.
  
  Structural comparisons that went through `JSON.stringify` use `deepEqual` instead, so key order no
  longer makes two equal values differ (theme baking, diagram export's style diffs, trial marks, path
  constraints, unit rows, toolbar dock drops). PrefSchemaEditor's three-way merge keeps
  `JSON.stringify`, because there a reordered key is an edit.
  
  New: `sameList(a, b, same?)` in `@weasel-js/registry`, whether two lists hold equal elements in
  order. `@weasel-js/react`'s `sameList` is now this function, and ui's `samePath` is an alias of it.

## 1.15.1

No changes in this release.

## 1.15.0

No changes in this release.

## 1.14.2

### Patch Changes

- 4bba14d: A scene's `add` and `remove` cost less again: a history builds the step it reports only when something observes its steps, and expands caused ops only when an op has them; a remove narrows an empty selection without building node gates; an empty pose-removal drain returns early; and a `kit:add` payload takes its optional fields by assignment. An emitter with no listeners now returns from `emit` without copying its listener set.

## 1.14.1

No changes in this release.

## 1.14.0

No changes in this release.

## 1.13.0

No changes in this release.

## 1.13.0-rc.0

No changes in this release.

## 1.12.0

No changes in this release.

## 1.11.1

No changes in this release.

## 1.11.0

### Patch Changes

- 304f53a: Actions and prefs carry `tags`: words they are also found by and gathered under. `Action.tags` and `ActionVariant.tags` (a variant carries its action's and its own, as `ActionItem.tags`); `tags` on every pref leaf, `PrefGroup`, and `PrefSection` (a leaf carries every group's above it). One matcher, `matchQuery` in `@weasel-js/registry`, now serves the command palette's search and `filterPrefSubtree`, so a query matches a tag as it matches a label, and `hasTag` is the exact test. Gathering by tag: `actionsTagged`, `taggedActionItems`, and `matchActionItem` (routing, re-exported by core), and `prefLeavesTagged` / `prefLeafTags` (prefs). `<ActionBar tag="…">` draws a bar from a tag in place of a `group`. A `CommandPalette` row found by a tag and not its label names that tag beside the label. The schema editor edits `tags` on leaves, groups, and sections; its structure, settings, unplaced, and action trees find rows by tag through the same matcher; and an `EditorAction` carries its registered action's tags, shown among what the registry says of the action a pref fires. `flip` is tagged `mirror`. Additive.
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
- 1be2ea9: New `deepEqual(a, b, { undefinedAsAbsent? })` in `@weasel-js/registry`: structural equality over arrays and plain objects from any realm, with every other value — a function, a class instance, a `Date` — equal only to itself. `undefinedAsAbsent` reads a key holding `undefined` as missing. `useCommand`, the schema editor's attribute aggregation, the selection panel's shared value, and text's range styles now all compare with it, in place of four private copies. Two of those copies compared a class instance field by field, and now compare it by identity: `useCommand`'s options and the schema editor's attribute values.

## 1.10.1

### Patch Changes

- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.

## 1.10.0

### Patch Changes

- 27b827e: text: the run algebra lives here now: `styleAtRange`, `applyStyleToRange`, `patchRangeStyle`, `effectiveRangeStyle`, `rangeWeight`, `setFlagOverRange`, `nodeHasFlag`, and `unboldPatch`, with the `RangeStyle`, `RunStylePatch`, `StyleKey`, `FlagKey`, and `SetFlagResult` types. `runsCarryStyling` and `supersededKey` are exported beside them. None of them needed a scene. The `MIXED` sentinel and its `Mixed` type moved to `@weasel-js/registry`, and text exports them too. `@weasel-js/core` still exports every name it did before.
- ee08fa5: Adds API: `Reflectable.release(key, registrant)` removes exactly one registrant from a key's stack, live or shadowed, whether `push` or `set` wrote it, and returns whether it was there. Removing the live one uncovers the one beneath. It shares one removal path with the function `push` returns, so releasing by either makes the other a no-op.
  
  Adds API: `ReflectedEntry.live` is the registrant holding the key. It is the same frozen object in every snapshot, and the one `shadowed` lists once something displaces it, so a row drawn from `reflection.entries()` can hand any registrant it shows straight to `release`. `value` and `source` stay on the entry as they were.

## 1.9.4

### Patch Changes

- 001aaae: `@weasel-js/registry` exports `createEmitter()`, one subscribe/notify pair with stated semantics: a pass calls the listeners held when it began, one unsubscribed before its turn is skipped, and a listener that throws is reported to `console.error` without stopping the others or throwing into the store. The reflectable registry, modes' scoping layer and decorations, and core's pose overrides, pose feed, layout reflow, parallax plane, and key state are built on it. For those stores, a listener that subscribes during a notify now waits for the next one, and a throwing listener no longer aborts the notify.
- 4d559ca: `isPlainObject` lives in `@weasel-js/registry` (core still exports it), and `@weasel-js/geom` exports a scalar `clamp(v, lo, hi)`. theme, prefs, labkit, and forge read plain objects through the one realm-safe test, so a `Date` or a `Map` no longer passes where they accept a record; ui's Slider and ResizeHandle, hud's loupe, and labkit's ZoomControl use geom's clamp. When its bounds cross, ResizeHandle now holds to `min` where it held to `max`. theme and prefs gain a dependency on registry, and ui's on geom moves from dev to runtime.

## 1.9.3

No changes in this release.

## 1.9.2

No changes in this release.

## 1.9.1

No changes in this release.

## 1.9.0

No changes in this release.

## 1.8.1

No changes in this release.

## 1.8.0

No changes in this release.

## 1.7.3

No changes in this release.

## 1.7.2

No changes in this release.

## 1.7.1

No changes in this release.

## 1.7.0

### Patch Changes

- a028cc3: New package `@weasel-js/registry`: `createReflectable()` is a keyed store a registry embeds to hand out a uniform read-only `Reflection` — `get`, `has`, `entries()`, `subscribe` and `getVersion`, shaped for `useSyncExternalStore`. Each entry reports the registrant's `source` and the registrants it displaced (`shadowed`), so overrides of one key show up as conflicts.
  
  The kit's module-level registries now expose one: `paintKindRegistry`, `markerRegistry`, `opFactoryRegistry`, `fontRegistry`, `fontOutlineRegistry` (which also notifies as a face's load state moves), and, from `@weasel-js/core/renderer`, `programSourceRegistry` and `textureRegistry`. `ModeRegistry` gains `reflection`. Built-in paint kinds and markers report `source: 'kit'`.
  
  Fixes paint-kind and marker overrides disposed out of order: with two overrides of one id, disposing the earlier and then the later used to restore the already-disposed earlier one instead of the built-in. Overrides now stack, and each disposer removes only its own entry.
