# @weasel-js/menu

## 2.0.0

### Major Changes

- 15e923d: `MenuGrade` is removed: a row's `grade` is `Grade` from @weasel-js/registry, the same type theme and ui use.
  
  ```ts
  import type { Grade } from '@weasel-js/registry'; // was: import type { MenuGrade } from '@weasel-js/menu'
  ```
  
  <!-- entry: breaking -->
- e90dcff: `@weasel-js/menu`'s `Rect` and `Size` are `MenuRect` and `MenuSize`.
  
  The `{ x, y, w, h }` box no longer shares a name with geom's `Rect`, which spells its size `width` and `height`.
  
  ```ts
  // before
  import type { Rect } from '@weasel-js/menu';
  // after
  import type { MenuRect } from '@weasel-js/menu';
  ```
  
  <!-- entry: breaking api -->
- 3a3ea2d: `MenuRect` and `MenuSize` name their size `width` and `height`, as the DOM's `DOMRect` and geom's `Rect` do.
  
  `placeMenu`, `placeMenuUnder`, `placeSubmenu`, a controller's `setPanel` and an open request's `under` take the new fields.
  
  ```ts
  // before
  const at = placeMenu({ w: 180, h: 240 }, anchor, { x: 0, y: 0, w: innerWidth, h: innerHeight });
  // after
  const at = placeMenu({ width: 180, height: 240 }, anchor, { x: 0, y: 0, width: innerWidth, height: innerHeight });
  ```
  
  <!-- entry: breaking api -->
- faf09b2: `MenuScheduler` is gone: `@weasel-js/menu` re-exports ui-input's `Scheduler`, which it was an alias of.
  
  `MenuControllerOptions.scheduler` takes one.
  
  ```ts
  // before
  import type { MenuScheduler } from '@weasel-js/menu';
  // after
  import type { Scheduler } from '@weasel-js/menu';
  ```
  
  <!-- entry: breaking api -->
- b9f3a12: A menu row built from an action shows the action's or variant's declared `shortcut` text, as the palette and bars already did.
  
  `MenuItemEntry.shortcut` is `MenuShortcut | string`: a string is printed as written. Code that formats it has to handle both.
  
  ```ts
  // before
  formatShortcut(entry.shortcut);
  // after
  typeof entry.shortcut === 'string' ? entry.shortcut : formatShortcut(entry.shortcut);
  ```
  
  <!-- entry: breaking fix -->
- 174d6ef: `@weasel-js/menu` no longer exports `MenuShortcut`; the shortcut shape is `ShortcutInput` from `@weasel-js/gestures`, which menu now depends on.
  
  `ShortcutInput` was already an alias of `MenuShortcut`, so the shape is unchanged; a menu row's `shortcut` takes a `ShortcutInput` or a string.
  
  ```ts
  // before
  import type { MenuShortcut } from '@weasel-js/menu';
  // after
  import type { ShortcutInput } from '@weasel-js/gestures';
  ```
  
  <!-- entry: breaking api -->
- 577b207: The submenu variant of `MenuEntry` is typed `MenuSubmenuEntry`, where it was `SubmenuEntry`, like `MenuSeparatorEntry` beside it.
  
  ```ts
  // before
  import type { SubmenuEntry } from '@weasel-js/menu';
  // after
  import type { MenuSubmenuEntry } from '@weasel-js/menu';
  ```
  
  <!-- entry: breaking api -->

### Minor Changes

- e06225e: A number shown with no locale given is written in the browser's language, and `en-US` where there is no browser.
  
  `present`, `qty`, `parseAs`, `formatNumber`, `formatCompact`, `parseNumber` and `menuNumberText` used to default to `en-US`; they now default to `defaultLocale()`, a new export: `navigator.language` narrowed by `fieldLocale` to one whose numbers read back as shown. Text written to be saved or read by a program passes `{ locale: 'en-US' }` itself.
  
  <!-- entry: rank=10 api behavior -->

### Patch Changes

- cbf6ee4: An access letter matches a typed key folded as search folds text, so typing `ς` finds an item whose letter is `Σ`.
  
  <!-- entry: fix -->
- 6a59fd6: A character typed during a menu's typeahead search extends the search, rather than choosing an access letter or stepping a number row.
  
  <!-- entry: fix behavior -->
- 7977b94: Moving the pointer from a submenu row onto a separator cancels the submenu's pending open, as moving into the panel's padding does.
  
  <!-- entry: fix -->
- Updated dependencies [5f856dc]
- Updated dependencies [e6b28fe]
- Updated dependencies [97f1f86]
- Updated dependencies [174d6ef]
- Updated dependencies [4f264d0]
- Updated dependencies [84028cb]
- Updated dependencies [269320b]
- Updated dependencies [bfc26b4]
- Updated dependencies [935346c]
- Updated dependencies [f6ee3ea]
- Updated dependencies [27eb7f9]
- Updated dependencies [754e0c6]
- Updated dependencies [aedb49f]
- Updated dependencies [ac8e807]
- Updated dependencies [fb47e9b]
- Updated dependencies [8257aa7]
- Updated dependencies [65e8ece]
- Updated dependencies [a947127]
- Updated dependencies [95bd84c]
- Updated dependencies [b7e560b]
- Updated dependencies [174d6ef]
- Updated dependencies [cfbecdb]
- Updated dependencies [9c2b3d6]
- Updated dependencies [03f84f2]
- Updated dependencies [8457029]
- Updated dependencies [22eec46]
- Updated dependencies [8fd3d6d]
- Updated dependencies [5b84825]
- Updated dependencies [516bc59]
- Updated dependencies [2338cee]
- Updated dependencies [57a59be]
- Updated dependencies [67968c3]
- Updated dependencies [8882b53]
- Updated dependencies [174d6ef]
- Updated dependencies [38e795b]
- Updated dependencies [e6871f1]
- Updated dependencies [56784d5]
- Updated dependencies [b54ab5f]
- Updated dependencies [0ecff6a]
- Updated dependencies [00a0e96]
- Updated dependencies [4bda721]
- Updated dependencies [7645aaa]
- Updated dependencies [24bca7a]
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
- Updated dependencies [d868c48]
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
- Updated dependencies [bd25e62]
- Updated dependencies [dc5efa8]
- Updated dependencies [510347b]
- Updated dependencies [8f28726]
- Updated dependencies [ff8c1f9]
- Updated dependencies [a6e8651]
- Updated dependencies [26cdc89]
- Updated dependencies [ad94222]
- Updated dependencies [2b0def2]
- Updated dependencies [80b8f57]
- Updated dependencies [1fe6cab]
- Updated dependencies [0481f49]
- Updated dependencies [b8bb2d4]
- Updated dependencies [6276cc6]
- Updated dependencies [6276cc6]
- Updated dependencies [677a841]
- Updated dependencies [b8bb2d4]
- Updated dependencies [cafdd8c]
- Updated dependencies [969aab0]
- Updated dependencies [61c9926]
- Updated dependencies [09dcf56]
- Updated dependencies [5024537]
- Updated dependencies [7489853]
- Updated dependencies [8fb09ad]
- Updated dependencies [ba7e062]
- Updated dependencies [5202a9f]
  - @weasel-js/ui-input@2.0.0
  - @weasel-js/quantity@2.0.0
  - @weasel-js/gestures@2.0.0
  - @weasel-js/registry@2.0.0

## 1.19.1

### Minor Changes

- 8763373: A hud menu's number rows write their value in the browser's locale, as a `@weasel-js/ui` number field beside them would: `2,5` in German.
  
  `attachMenuHost` and `createMenuWidget` take a `locale` option to name another, and `menuNumberText(value, entry, locale)` takes one as a third argument, `en-US` by default.
  
  <!-- entry: api behavior -->

### Patch Changes

- 0a483ad: A space typed mid-search in a menu is part of the search, as in a list: typing "save a" finds "Save As…" instead of choosing "Save".
  
  <!-- entry: fix behavior -->
- Updated dependencies [5159b4f]
- Updated dependencies [c9adfef]
- Updated dependencies [97be45c]
- Updated dependencies [5159b4f]
- Updated dependencies [039b7ad]
- Updated dependencies [d254251]
- Updated dependencies [8562ebe]
- Updated dependencies [250c105]
- Updated dependencies [a09ed24]
- Updated dependencies [8562ebe]
  - @weasel-js/ui-input@1.19.1
  - @weasel-js/quantity@1.19.1
  - @weasel-js/registry@1.19.1

## 1.19.0

### Patch Changes

- 84e0536: An access letter declared decomposed, such as `e` followed by a combining acute, is read composed, so the `é` key chooses its row.
  
  <!-- entry: rank=-5 fix -->
- 994f696: A typeahead or access letter that lands on the row already highlighted leaves the menu as it was and notifies no subscribers.
  
  <!-- entry: rank=-5 fix perf -->
- 994f696: `placeMenuUnder` keeps a menu opened on the `top` or `left` side of its button inside `bounds` when the button sits past the far edge.
  
  <!-- entry: fix -->
- 994f696: A submenu's diagonal allowance no longer holds for a pointer moving away along a flattened triangle's line.
  
  <!-- entry: rank=-5 fix -->
- 30c0e8e: A unit catalog in `@weasel-js/quantity` gives each unit one symbol, compact form and spoken name, read wherever units are shown or typed.
  
  Each entry has a unit's canonical name, its symbol, a compact form for tight spaces (`″` for `in`, `′` for `ft`), the aliases that read as it, its spoken names or `Intl` unit, its CSS unit, and whether its glyph attaches to the number (`°`, `′`, `″`, `%`). `catalogUnit`, `unitSymbol`, `unitSpellings`, `withUnit` and `speakUnit` read it, and `registerUnit` adds or replaces a unit and returns a function that takes it back out. The `unit` display, the bytes and duration displays' speech, `parseNumber`'s alternate spellings and `prefsCss`'s CSS units all read the catalog, in place of the tables each kept.
  
  `UnitDisplay` and a prefs unit take `compact: true` for a unit's compact form, and a unit is written as the catalog writes it, so `unit('deg')` and a prefs unit with `suffix: 'deg'` show `°`.
  
  In `@weasel-js/ui`, a field's or readout's unit whose glyph attaches stays on the value's line in every layout, including an inline slider row that hangs word units below its readout, and is out of flow, so the field is the same size with it as without. The catalog decides which units attach: a property field's string `unit`, a menu number row's `suffix` and a read-only readout all ask it. `QuantityText`'s `unit` takes `compact` and marks an attaching unit `data-attach`.
  
  Breaking: `unit('"')` now shows `12″` and `unit("'")` shows `1′`, the compact forms those marks are aliases of, and a unit named by an alias shows its symbol (`deg` shows `°`). A degree passed as `<sup>°</sup>` still draws as given but no longer attaches; pass the string `'°'`. `ResolvedPrefUnit.suffix` is the text a field shows, the catalog's form of the one written. Typed text reads every spelling the catalog knows for a unit a table accepts, so a field accepting `deg` also reads `°`. A scale indicator's label is spoken through the catalog, `Scale: 10 feet`.
  
  <!-- entry: rank=20 breaking api new visual pick -->
- Updated dependencies [93ed93d]
- Updated dependencies [3932826]
- Updated dependencies [0e15698]
- Updated dependencies [c913ef0]
- Updated dependencies [041dbf7]
- Updated dependencies [4ff3e3e]
- Updated dependencies [785627a]
- Updated dependencies [3e4a895]
- Updated dependencies [302c660]
- Updated dependencies [0cff741]
- Updated dependencies [b1309b2]
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
- Updated dependencies [20c4979]
- Updated dependencies [44aa42f]
- Updated dependencies [a612a95]
- Updated dependencies [10199c0]
- Updated dependencies [644c5c7]
- Updated dependencies [521cab5]
- Updated dependencies [8936d41]
- Updated dependencies [8936d41]
- Updated dependencies [8936d41]
- Updated dependencies [7b56e88]
- Updated dependencies [279a193]
- Updated dependencies [521cab5]
- Updated dependencies [76da952]
- Updated dependencies [228d835]
- Updated dependencies [521cab5]
- Updated dependencies [e198aad]
- Updated dependencies [7dd964d]
- Updated dependencies [30c0e8e]
- Updated dependencies [592f6ec]
  - @weasel-js/ui-input@1.19.0
  - @weasel-js/quantity@1.19.0
  - @weasel-js/registry@1.19.0

## 1.18.2

### Patch Changes

- Updated dependencies [1549044]
- Updated dependencies [91b9542]
- Updated dependencies [b188aea]
- Updated dependencies [be6244b]
  - @weasel-js/ui-logic@1.18.2
  - @weasel-js/registry@1.18.2
  - @weasel-js/quantity@1.18.2

## 1.18.1

### Patch Changes

- 7a33153: Describe and grade actions in data, and give each variant its own state
  
  - An action takes a `description`, which a toolbar button reads as its tooltip, and a menu row and a palette row as their hint, and a `grade` (`'danger'` for one that destroys something), which a menu row and a palette row draw in their grade's color and a toolbar button shows while pointed at. A variant may set its own of either, and its own `shortcut` text; each falls back to the action's. `ActionItem` carries all three, resolved.
  - `enabled` is handed the params a run would get as its fourth argument, and `active` as its second, so the variants of one action can each be pressed or unavailable on their own: align left pressed while right is not, Bring Forward unavailable at the top of the stack. Bars, menus and the command palette ask once per variant, and the dispatcher hands the gate a binding's `opts.params`, so a key for one variant runs only when that variant can. An action that ignores the new argument behaves as before.
  - `useCommand` takes `shortcut`, `preview`, `settings`, `description` and `grade`, and hands its `enabled` and `active` the params asked about. `CommandSettings` is an `ActionSettings` whose `read` takes no deps.
  - `@weasel-js/menu`: an item and a submenu row take `description` and `grade` (`MenuGrade`, the theme's `Grade`), and a submenu, number, color and text row take `disabledReason`. ui's menu rows show a reason or a description in their tip and as their accessible description; hud's canvas menus draw a graded row's label in its color and describe a row to assistive tech the same way. `HudAccessibleNode` takes a `description`, mirrored as `aria-description`.
  - `BarActionButton` takes a `grade`, and `useLeafAction` answers a `description` (the leaf's, else the action's) and a `grade`.
- @weasel-js/quantity@1.18.1
  - @weasel-js/registry@1.18.1
  - @weasel-js/ui-logic@1.18.1

## 1.18.0

### Patch Changes

- 12c538a: The select tool reads a `'single'` press as a replace rather than as an extend-click, so `extendClickLocked` no longer refuses one. `beginJournal`'s `coalesceWindowMs` takes a function, as `createHistory`'s does. A menu arrow key that leaves the highlight where it was no longer notifies subscribers or clears the typeahead buffer.
- 56e54c0: Fix three gaps in guides, menus and the HUD menu.
  
  - Moving a placed guide off the rulers now snaps to the edges and centers of the top-level nodes, as placing a new one does. `alignmentSnapSource` took the guide's id as a node whose siblings to measure, and found none.
  - A menu access letter, or a typeahead key, outside the Basic Multilingual Plane (an emoji) is now read as one character.
  - A HUD menu's color picker checks the swatch the color holds at its current alpha, so the swatch just chosen shows checked after the alpha has changed.
  
  A list's typeahead counts a typed key by code point, as menus now do, so an emoji types and a repeated one cycles; `isOneChar` from `@weasel-js/ui-logic` is the one rule both use.
- Updated dependencies [26e836e]
- Updated dependencies [b93c1dd]
- Updated dependencies [d83476e]
- Updated dependencies [56e54c0]
- Updated dependencies [1e0adbb]
- Updated dependencies [8c39a05]
- Updated dependencies [b470ff1]
- Updated dependencies [a287c54]
  - @weasel-js/quantity@1.18.0
  - @weasel-js/registry@1.18.0
  - @weasel-js/ui-logic@1.18.0

## 1.17.3

### Patch Changes

- 5bda052: A command can say why it is disabled in its own words: `useCommand`'s `enabled` may now return a sentence, as an action's `enabled` already could, and the palette and bar buttons show it the way they show an action's. Menus now say why too: a menu item entry carries `disabledReason`, `resolveMenu` fills it from the action's or command's answer, and a DOM menu shows a disabled row's reason in a tooltip once the highlight rests on the row, keeping its shortcut, and gives it to assistive tech as the row's description.
- @weasel-js/ui-logic@1.17.3
  - @weasel-js/quantity@1.17.3
  - @weasel-js/registry@1.17.3

## 1.17.2

### Patch Changes

- 1dda7c2: Menus follow a right-to-left layout. `keyStep`, `planKey` and a controller's `key` take an optional direction: under `'rtl'` Left opens a submenu and Right closes one, and an edge still reports forward as 1 and back as -1. `placeMenu`, `placeSubmenu` and `placeMenuUnder` take one too, and under `'rtl'` open to the left first (a menu under a button right-aligns to it). `ContextMenuHost`'s panels read the direction from their own computed `direction`, and `MenuBar` steps between titles by its bar's, so Left moves to the next title.
- Updated dependencies [5cb2995]
- Updated dependencies [4c781a6]
- Updated dependencies [d08837f]
- Updated dependencies [a08b740]
- Updated dependencies [29f15a5]
- Updated dependencies [05acca8]
  - @weasel-js/quantity@1.17.2
  - @weasel-js/ui-logic@1.17.2
  - @weasel-js/registry@1.17.2

## 1.17.1

### Patch Changes

- @weasel-js/quantity@1.17.1
  - @weasel-js/registry@1.17.1
  - @weasel-js/ui-logic@1.17.1

## 1.17.0

### Patch Changes

- 5d66b8b: A number, text, or color row's access letter highlights the row, where Enter then edits it. It did nothing: only an item's letter chose it and only a submenu's opened it.
- Updated dependencies [4264abb]
- Updated dependencies [d53bb96]
  - @weasel-js/quantity@1.17.0
  - @weasel-js/ui-logic@1.17.0
  - @weasel-js/registry@1.17.0

## 1.16.2

### Patch Changes

- @weasel-js/ui-logic@1.16.2
  - @weasel-js/quantity@1.16.2
  - @weasel-js/registry@1.16.2

## 1.16.1

### Patch Changes

- Updated dependencies [25a1ff7]
- Updated dependencies [017246d]
  - @weasel-js/registry@1.16.1
  - @weasel-js/quantity@1.16.1
  - @weasel-js/ui-logic@1.16.1

## 1.16.0

### Patch Changes

- @weasel-js/ui-logic@1.16.0
  - @weasel-js/quantity@1.16.0
  - @weasel-js/registry@1.16.0

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
- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
  - @weasel-js/registry@1.15.2
  - @weasel-js/ui-logic@1.15.2
  - @weasel-js/quantity@1.15.2

## 1.15.1

### Patch Changes

- fa1c9a7: A menu item entry takes `radio: true`, and a menu draws it as a `menuitemradio` rather than a `menuitemcheckbox`. `resolveSchemaMenu` sets it on an enum's options, a union's variants and a field reference's choices, so screen readers hear them as one choice among several.
  `CommandPalette` shows an action's own `shortcut` text when it has one, before falling back to its bindings as keycaps.
  A `Dialog` in a contained portal opens from an enclosing `<DialogTrigger>` when it is given no `isOpen`.
  `CurveEditor` takes an `aria-label` and names its plot with it.
  A `Callout` keeps a `style` it is given alongside its stance, grade and tint, rather than losing it to them.
  `Callout`, `LastOperationPanel` and `DragGhost` draw their shadow from `--wzl-bevel-raised` when a theme sets it, as `Dialog` and the menu popovers do.
  `Button`'s busy spinner stops turning under `prefers-reduced-motion: reduce`.
  Breaking: `BarPopover`'s `isDisabled` prop is now `disabled`, as every other Bar part names it.
- Updated dependencies [5e66a10]
- Updated dependencies [8b52282]
- Updated dependencies [13b0604]
  - @weasel-js/quantity@1.15.1
  - @weasel-js/ui-logic@1.15.1

## 1.15.0

### Patch Changes

- @weasel-js/headless@1.15.0
  - @weasel-js/quantity@1.15.0

## 1.14.2

### Patch Changes

- @weasel-js/headless@1.14.2
  - @weasel-js/quantity@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/headless@1.14.1
  - @weasel-js/quantity@1.14.1

## 1.14.0

### Patch Changes

- b142892: Add `attachMenuDismiss` to `@weasel-js/menu`: it closes a menu on a press or wheel outside it, on the window losing focus, and on a resize, attaching to any `Window`-like target and returning a detach. `press: false` leaves out the press listener, and `keepOnBlur` keeps the menu open through a blur. ui's `ContextMenuHost` and hud's `attachMenuHost` both dismiss through it.
  
  `normalizeHex` takes an optional form: `'rgb'` drops alpha, `'rgba'` always writes it (`ff` when none was named). `tryNormalizeHex` is the same, returning undefined where `normalizeHex` throws. hud's color row and ui's `ColorField` and `TokenPanel` read hex through them. hud's hex row now accepts `#rgba` shorthand, and `ColorField` shows a malformed `#` value as black rather than passing it to the color input.
  
  core's `toHex8`, `getAlpha01`, `withAlpha01` and `mergeAlphaFromPrev` read hex through `tryNormalizeHex` too. A malformed `#` value (`#xyz`, `#12345`) now comes back unchanged instead of expanded into an invalid 8-digit string, and `getAlpha01` reads 1 from one. `toHex8` now lowercases `#RRGGBB` as it already did every other hex form, and ignores surrounding whitespace.
- 11e2b7d: New package, `@weasel-js/headless`: a list's roving highlight and typeahead, generic over the item type. `rovingKey` moves a highlight on the arrows, Home and End, skipping items `canStop` refuses, for a vertical or horizontal list, with or without wrap; `typeaheadStep` finds an item by its typed prefix and cycles on a repeated letter. `@weasel-js/menu` now runs each menu level on them and depends on the new package; its own exports and behavior are unchanged.
- b59380e: Holding a step chip on a `@weasel-js/hud` canvas menu's number row now repeats, as a `@weasel-js/ui` number field's steppers do: one step on the press, then after 400 ms one every 60 ms until release, until the pointer leaves the chip, or until the value reaches its bound. The step now comes on the press rather than the release. `attachMenuHost` and `createMenuWidget` take `repeat` to time it.
  
  `@weasel-js/headless` exports `createStepRepeat`, the hold-to-repeat both run, with `REPEAT_DELAY_MS`, `REPEAT_EVERY_MS`, and `Scheduler` / `timerScheduler` for the clock it runs on; `@weasel-js/menu`'s `MenuScheduler` is now that `Scheduler`. `@weasel-js/quantity` exports `canSpin(key, from, bounds)`, whether a spin key moves a value anywhere, which `menuNumberCanStep` and `UnitField`'s steppers both use. This adds API.
- 4aa138a: A color leaf drawn as a menu is now editable. `MenuColorEntry` gains `set` and `alpha`, and the controller holds a color row's value as it does a text row's (`colorValue`, `setColor`). `resolveSchemaMenu` passes `set` for a color leaf that is not a `readout` when `onChange` is given. In the DOM menu, pressing such a row, or Enter on it, opens the kit's `ColorField` in a popover beside the row; a press inside the popover does not dismiss the menu, and each committed color is written without closing it. A color row without `set` stays read-only. Adds API.
- 5e24531: A menu item can keep its menu open: with the new `keepOpen` flag on `MenuItemEntry`, choosing the row runs it, highlights it, and leaves the menu open, and the controller's subscribers hear the change so a renderer redraws the row's `checked` state. Both ui's DOM menu and the HUD menu honor it, since both run items through the controller. Adds API.
- Updated dependencies [1c046e3]
- Updated dependencies [11e2b7d]
- Updated dependencies [3c3a219]
- Updated dependencies [767713e]
- Updated dependencies [b59380e]
- Updated dependencies [ba998f9]
- Updated dependencies [9a963cd]
- Updated dependencies [6cb0cf6]
- Updated dependencies [624cf38]
- Updated dependencies [230a206]
- Updated dependencies [d5c4ee6]
  - @weasel-js/headless@1.14.0
  - @weasel-js/quantity@1.14.0

## 1.13.0

### Patch Changes

- 1f2a0b3: A menu hung from a button opens on a side of it, not only below or above. `placeMenuUnder`'s last argument is now a `MenuSide` (`'top' | 'bottom' | 'left' | 'right'`, default `'bottom'`) where it was the boolean `above`; beside the button the menu is top-aligned and flips to the other side when it does not fit. `MenuOpenRequest` and `OpenMenu` carry `side` in place of `above`. This is a breaking change for anyone passing `above`: pass `side: 'top'` instead. A curved `Bar`'s menus now open on the side their item faces, where `'left'` and `'right'` used to open below.
- Updated dependencies [04b862d]
- Updated dependencies [86f67ad]
  - @weasel-js/quantity@1.13.0

## 1.13.0-rc.0

### Patch Changes

- 1f2a0b3: A menu hung from a button opens on a side of it, not only below or above. `placeMenuUnder`'s last argument is now a `MenuSide` (`'top' | 'bottom' | 'left' | 'right'`, default `'bottom'`) where it was the boolean `above`; beside the button the menu is top-aligned and flips to the other side when it does not fit. `MenuOpenRequest` and `OpenMenu` carry `side` in place of `above`. This is a breaking change for anyone passing `above`: pass `side: 'top'` instead. A curved `Bar`'s menus now open on the side their item faces, where `'left'` and `'right'` used to open below.
- Updated dependencies [04b862d]
- Updated dependencies [86f67ad]
  - @weasel-js/quantity@1.13.0-rc.0

## 1.12.0

### Patch Changes

- dbd6711: Controls can run along a curve. `@weasel-js/geom` adds track shapes (`lineShape`, `arcShape`), reading runs over them
  (`trackRun`, whose `nearest` can leave the ends open) and their SVG path data (`trackShapeD`). `@weasel-js/ui` adds
  `Along`, which sizes an arc from its box and hands it to the controls inside; `Slider`, `DetentSlider` and `Bar`
  follow it, or a `shape` prop. `TrackCtx` gains a required `shape` field — the value span as a shape — so code that
  builds a `TrackCtx` itself no longer typechecks until it supplies one. `paintGradientTrack` paints straight tracks
  only. A menu opened under a button can ask to open above it (`placeMenuUnder`'s `above`, `MenuOpenRequest.above`).
- c2fb65c: Keymaps behind a leader key. `keymapContribution` builds a keymap, whose bindings are live only while
  it is open, and the leader that opens it: tap the leader for one input, or hold it to keep the keymap
  open. Escape always closes it; a key it does not bind is ignored, or passed on under the new
  `gestures.keymapUnbound` kit setting. `<KeymapHint>` lists an open keymap's keys, and `formatShortcut`
  draws a key inside one as `Loupe ▸ 2`.
  
  Bindings can now be rebound or removed by id, on actions and contributions alike:
  `ActionsRegistry.overrideBindings` and `<SceneCanvas bindingOverrides>`, written as route strings or
  with the new `key()`, `held()` and `unbound()` helpers. `captureKey` reads the next keystroke for a
  binding editor.
  
  `modeShortcutSpec` now reads through `key()`, so a mode shortcut written `'Space'` or `'Esc'` names
  the key it says; before, either matched nothing.
  
  Additive: `ActionsRegistry` gains `overrideBindings` and `bindingOverrides`, so a hand-written
  registry must implement them.
- @weasel-js/quantity@1.12.0

## 1.11.1

### Patch Changes

- c2dfd4e: A menu can hold a line of text edited in place: `MenuTextEntry` (`kind: 'text'`), with the controller's `textValue` and `setText` holding what was typed while the menu stays open. A string leaf in a schema drawn as a menu becomes one when something writes it, and stays a read-only `Name: value` row when it is a `readout` or nothing does. The DOM menu draws a text field that Enter on the row focuses; Enter or blur writes the text and Escape puts it back. The HUD menu has no text entry, so it draws the row's value read-only.
- Updated dependencies [433540d]
  - @weasel-js/quantity@1.11.1

## 1.11.0

### Patch Changes

- 90851d1: A schema drawn as a menu keeps its number, color, and string leaves. `resolveSchemaMenu` turns a number leaf into a new `number` menu entry, in the units the leaf shows, and a color leaf into a new `color` entry; a string reads as a disabled `Name: value` row. Both are new `MenuEntry` kinds, so code that switches over every kind needs a case for each.
  
  A number row edits in place and the menu stays open. The DOM menu holds a field in the row: Enter on the highlighted row moves focus into it, the arrow keys step it there, and Enter or Escape hands focus back to the menu. The HUD menu draws a minus and a plus chip either side of the value. In both, `+` and `-` step the highlighted row. The menu controller's new `numberValue`, `setNumber`, and `spin` hold what was set while the menu is open, and `menuNumberText` prints a value as a renderer with no field does.
  
  A color row shows a swatch and the hex and is read-only in both menus.
  
  `clampToBounds`, `snapToStep`, and `spinKey` move from `@weasel-js/ui`'s internals to `@weasel-js/quantity`, where the menu model steps with them too.
- 797bf34: A number row in a menu drawn from a schema now honors the leaf's `endless` and `infinity`. An endless end sits one step past its bound, as it does on an endless slider, so stepping up from the bound reaches infinity, and an infinity stored there shows as the leaf's word for it, with no unit after it. This holds in the DOM menu and the HUD menu alike. The DOM menu's field also reads typed units now, in any unit the leaf's `unit` accepts.
  
  `clampToBounds` and `spinKey` in `@weasel-js/quantity` take an `endless` bound. `endlessAllows`, `endlessAt`, `endlessTrack`, and the `Endless` type have moved there from `@weasel-js/ui`, which still re-exports `Endless`. `UnitField` takes `endless` as well, so a property row's plain number field keeps an infinity typed at an endless end where it used to clamp it to the bound. `prefUnitAccepts` is now exported from `@weasel-js/prefs`, which ui and routing both use. `prefDisplayBounds` returns the leaf's `endless`, with its ends swapped under a unit that runs backward. `MenuNumberEntry` gains `endless`, `infinity`, and `accepts`. `menuNumberText` now takes the entry in place of a suffix and a display.
- fe20dc4: New package: the headless model behind context menus — menu entries, keyboard and pointer behavior, and placement that keeps a menu and its submenus inside their bounds. It draws nothing; `@weasel-js/ui` and `@weasel-js/hud` render it.
- da45b33: `MenuShortcut` is now the one shortcut shape, and `@weasel-js/gestures`' `ShortcutInput` is an alias of it rather than a wider copy: a key list naming spellings of one keycap, optional modifiers, and `shift: 'optional'`. A tool's `keybinding` can be a menu row's shortcut as-is. `@weasel-js/gestures` now depends on `@weasel-js/menu`, for that type only; menu still needs no React and no DOM. routing's `ActionShortcut` is the same type under a third name.
- 57725cc: Menus hang under a rect and register commands from callbacks. `placeMenuUnder` in `@weasel-js/menu` is new public API: it places a menu under a rect, flips it above, and right-aligns it at the right edge. `MenuOpenRequest.under` is an additive field, honored by the DOM and WebGL menu renderers, and `BarMenu` passes its button's rect. `BarMenu` takes an additive `defaultOpen` prop: it opens the menu once on mount, without taking focus, retrying as commands register until the menu has rows. `useCommand(id, label, run, options?)` is new public API in `@weasel-js/routing/react` and `@weasel-js/core`; its `icon` option takes an `IconRef`. The asset editor files menu roots under a "Menus" heading and previews them open.
- 2f51085: Menus take access letters and links. `access` on `PrefBase`, `PrefGroup` and `PrefSection` names a menu item's letter; the resolver carries it, and an alias's own letter wins over its target's. `@weasel-js/menu` gains `accessMatch` (finds the item a typed letter selects), `withLinks` (runs a link row's `href` through a navigator the host passes), and `href` and `current` on items. `onEdge` is new on the menu controller, called when Left or Right is pressed at a boundary. Link rows now navigate in the WebGL host. `KeyEffect` gained an `edge` variant, and `keyStep` now returns it for Left and Right at a boundary, which breaks a consumer that switches exhaustively over the effect: add a case for it.
- Updated dependencies [90851d1]
- Updated dependencies [797bf34]
- Updated dependencies [59b5936]
  - @weasel-js/quantity@1.11.0
