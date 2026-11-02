# @weasel-js/prefs

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
