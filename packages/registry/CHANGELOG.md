# @weasel-js/registry

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
