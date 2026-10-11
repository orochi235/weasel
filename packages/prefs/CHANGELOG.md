# @weasel-js/prefs

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
