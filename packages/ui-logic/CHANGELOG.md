# @weasel-js/ui-logic

## 1.18.1

### Patch Changes

- @weasel-js/geom@1.18.1
  - @weasel-js/quantity@1.18.1

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
- 56e54c0: Fix three gaps in guides, menus and the HUD menu.
  
  - Moving a placed guide off the rulers now snaps to the edges and centers of the top-level nodes, as placing a new one does. `alignmentSnapSource` took the guide's id as a node whose siblings to measure, and found none.
  - A menu access letter, or a typeahead key, outside the Basic Multilingual Plane (an emoji) is now read as one character.
  - A HUD menu's color picker checks the swatch the color holds at its current alpha, so the swatch just chosen shows checked after the alpha has changed.
  
  A list's typeahead counts a typed key by code point, as menus now do, so an emoji types and a repeated one cycles; `isOneChar` from `@weasel-js/ui-logic` is the one rule both use.
- 8c39a05: Add `selection` and `selectionOfEach` to `@weasel-js/ui-logic`: which of a run of items are on, as one value, a list of them, or a boolean each item owns. The model gives each item's state (`on`, `off`, `mixed`), what a press does, and an `edit` that sets several in a row and can be reverted; `sweepFrom` is a sweep's run over it, `selectionKeys` says what the keyboard does with it, and `@weasel-js/ui`'s `selectionRoving` hands that to `useRovingTabIndex`. `ToggleBar` and `OptionsBar` run on it.
  
  `ToggleBar`'s single mode takes `mixedValues` and `followsFocus`. With `followsFocus: false` its segments are toggle buttons whose arrows move focus without choosing, so a clearable enum's toggle in a property panel is a single-mode bar rather than a multiple-mode one held to one value.
- b470ff1: Add `<Sequence>`: one component repeated over the steps of a parameter
  
  - `Sweep` (ui-logic) is a parameter's domain, apart from how it is walked: `at(u)` reads it as a scrubber does, one value from 0 to 1 along it, and `walk()` reads every step at once. `range` (by `step`, or `count` samples), `values`, `frames` (a clock's run, `every` ms apart, one pass or `passes: 'all'`) and `until` (stop before the first step a predicate accepts) build one; `stepsOf` takes up to a cap from one that never ends.
  - `<Sequence sweep>` (ui) renders its child once per step, captioned with the sweep's label, wrapped or as one scrolling strip. Given `across`, a second sweep, it lays out every pairing as a grid with its rows and columns labeled. Each cell is live. This is new API.
  - `<HeldClock spec at>` (labkit) gives what renders inside a clock of its own, paused at `at`, which `useTrialClock` and `useClockFrame` read in place of the trial's; a clock that is not seekable is run there `step` ms a frame. `<ClockFrames spec every>` is a `<Sequence>` of a clock's frames, each under one.
  - `fieldSweep(node)` (labkit) walks the values a config field's control offers: a number's stops or its range by its step, an enum's options, a boolean's off and on.
  - forge's `usePlayhead` and `useTimeline` read the clock of a `<HeldClock>` around them ahead of the story's own (labkit's `useHeldClock`), so a story's clock-driven component shows the held moment in each frame of a `<ClockFrames>`.
  - forge's API panel lists required props first, then every prop by name; their `required` badge takes the secondary accent, and badges there read in the body font rather than the code font.
- a287c54: Add `tileGrid` to `@weasel-js/ui-logic`: a run of same-size items laid out as a grid `columns` across, with a short last row at its start, centered, at its end, or stretched across the row (`lastRow: 'fill'`), giving its tracks, each item's span, and which of the grid's outer corners each item sits on. `@weasel-js/ui`'s `tiling` draws it as a CSS grid: the container's class and style and each item's attributes, among them `data-tile-corners`; `tilingRoving` gives the matching `useRovingTabIndex` options. `SwatchGrid` and `ToolGroup` now lay out through it.
  
  `ToggleBar`, `ButtonBar` and `OptionsBar` take `columns` and `lastRow`, wrapping their segments into a grid in one well rounded at its outer corners. A sweep runs across the rows.
  
  `rovingGridTarget` moves from `@weasel-js/ui` to `@weasel-js/ui-logic`, beside `rowOffset`, `gridLayout`, and `tileKey` (the same for a run tiled by a spec, which `SwatchGrid` now walks by), and takes a layout (`{ dir, offsets, widths }`) in place of its `dir` argument: Up and Down move to the item drawn under the focused one in a row that sits off the start or is stretched, the later of two half-covering it going down and the earlier going up. `useRovingTabIndex` takes `lastRow`. A Down or Up with no item beneath now lands on that row's nearest item in `SwatchGrid` too, as it already did in every other roving grid, where before it stayed put.
- Updated dependencies [b7ef242]
- Updated dependencies [26e836e]
- Updated dependencies [206b78d]
- Updated dependencies [a78c393]
- Updated dependencies [cfe8a8a]
- Updated dependencies [b93c1dd]
- Updated dependencies [d83476e]
- Updated dependencies [89b2c65]
- Updated dependencies [1e0adbb]
  - @weasel-js/geom@1.18.0
  - @weasel-js/quantity@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [13c6f66]
  - @weasel-js/geom@1.17.3
  - @weasel-js/quantity@1.17.3

## 1.17.2

### Patch Changes

- d08837f: `moveItems` ignores an index outside the list entirely. Such an index used to be skipped when picking the items to move but still counted toward where they landed, so `moveItems(list, [-1, 1], 3)` put the item one place short. A gap past either end of the list is now that end.
- 05acca8: A held stepper whose repeated step ends or replaces the hold (`createStepRepeat`'s `step` calling `stop` or `start`) no longer keeps repeating the old key: only the first step was checked for this before.
- Updated dependencies [5cb2995]
- Updated dependencies [dd926dc]
- Updated dependencies [4c781a6]
- Updated dependencies [a08b740]
- Updated dependencies [29f15a5]
- Updated dependencies [90024bc]
  - @weasel-js/quantity@1.17.2
  - @weasel-js/geom@1.17.2

## 1.17.1

### Patch Changes

- @weasel-js/geom@1.17.1
  - @weasel-js/quantity@1.17.1

## 1.17.0

### Patch Changes

- Updated dependencies [6539d70]
- Updated dependencies [b497b07]
- Updated dependencies [75ef6d9]
- Updated dependencies [12e9c39]
- Updated dependencies [9d25103]
- Updated dependencies [3b08834]
- Updated dependencies [ceff0c3]
- Updated dependencies [4264abb]
- Updated dependencies [d53bb96]
- Updated dependencies [454e8e1]
  - @weasel-js/geom@1.17.0
  - @weasel-js/quantity@1.17.0

## 1.16.2

### Patch Changes

- Updated dependencies [944faa2]
- Updated dependencies [847875c]
  - @weasel-js/geom@1.16.2
  - @weasel-js/quantity@1.16.2

## 1.16.1

### Patch Changes

- Updated dependencies [3afef45]
- Updated dependencies [5a2e82a]
- Updated dependencies [017246d]
  - @weasel-js/geom@1.16.1
  - @weasel-js/quantity@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/geom@1.16.0
  - @weasel-js/quantity@1.16.0

## 1.15.2

### Patch Changes

- e804540: **Behavior change:** `matchesKeyBinding` and `historyKey` now read `mod` the way `@weasel-js/gestures`
  does: Command on an Apple platform, Ctrl elsewhere, and the other key forbidden. Before, either key
  fired a `mod` binding on every platform, so Ctrl+Z undid on a Mac and Cmd+Z undid on Windows; now
  neither does, and neither does Cmd+Ctrl+Z. Both take an optional `isMac` argument, defaulting to
  `isApplePlatform()`. Everything built on them follows: labkit's trial chrome and `useUndoKeys`, and
  the undo keys in `AssetEditor`, `LayeredCurveEditor` and forge's CSS-vars panel. A trial's snapshot
  chord is Mod+S alone; Shift+Mod+S no longer takes a snapshot.
  
  `rowKey` takes a sixth argument, `apple`, and selects all on Mod+A as above; Ctrl+A on a Mac no
  longer selects all in a `Tree` or any list on `useRowNavigation`, which passes `isApplePlatform()`.
  `rowKey` called without it reads `mod` as Ctrl.
  
  `@weasel-js/react` reads the system color scheme: `systemColorScheme()`, `watchColorScheme(fn)` and
  `useSystemColorScheme(follow?)`, with `DEFAULT_COLOR_SCHEME`, dark, wherever `matchMedia` is missing or
  the system states no preference. Dark is the mode the theme's tokens paint at `:root`. theme's
  `useResolvedColorMode`, core's `watchThemeOf` and forge's loupe conditions use it. **Behavior change:**
  forge's loupe read a missing `matchMedia` as light; it now reads it as dark, as the theme always has.
  
  `scene.mintId()`, and the id `add` gives a spec with none, now pass over any id the scene already
  holds. A document reopened in a new session keeps the ids the last one minted, and a `generateId` that
  starts over with the session could mint them again; a generator that gives 1000 taken ids in a row
  throws.
- Updated dependencies [c6edab2]
- Updated dependencies [a4138b6]
- Updated dependencies [5a0375b]
- Updated dependencies [5f6111b]
  - @weasel-js/geom@1.15.2
  - @weasel-js/quantity@1.15.2

## 1.15.1

### Patch Changes

- 8b52282: A measure/draw contract a control implements on every target it is drawn on: `HeadlessComponent`, whose `measure`
  is shared code reading the target's tokens and text metrics through a `MeasureEnv`, and whose `draw` is the
  target's own. `@weasel-js/ui-logic` adds `measureButton` and `measureRowList` with the parts and roles they lay out
  (`buttonParts`, `listMode`, `LIST_ROLES`), and `pressStep` for a press's hover and hold. ui's `Button` and
  `ItemList` implement it as `domButton` and `domItemList` (measure with `domMeasureEnv(el)`); the HUD's button and a
  new `list` widget (`hud.list`, ui's `ItemList`'s keyboard and listbox semantics) implement it as `hudButton` and
  `hudList` (`hudMeasureEnv`).
  
  The HUD button now lays its label out the way the DOM button does: centered, at the theme's `--wzl-font-size`
  rather than 13px when `fontSize` is not given, on a body rounded by `--wzl-button-radius` or a tenth of its height.
  It takes a `size` option. A HUD accessibility node can say `selected` and `multiselectable`.
- 13b0604: New name for what `@weasel-js/headless` held through 1.15.0: component behavior a DOM component and a canvas-drawn widget share, with no React and no DOM. The exports are unchanged; change the import specifier from `@weasel-js/headless` to `@weasel-js/ui-logic`.
- Updated dependencies [5e66a10]
- Updated dependencies [2992b55]
  - @weasel-js/quantity@1.15.1
  - @weasel-js/geom@1.15.1

## 1.15.0

### Patch Changes

- Updated dependencies [b7d362d]
- Updated dependencies [a95d3a4]
- Updated dependencies [30bf607]
- Updated dependencies [48b6c4c]
- Updated dependencies [fce0494]
  - @weasel-js/geom@1.15.0
  - @weasel-js/quantity@1.15.0

## 1.14.2

### Patch Changes

- @weasel-js/geom@1.14.2
  - @weasel-js/quantity@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/geom@1.14.1
  - @weasel-js/quantity@1.14.1

## 1.14.0

### Patch Changes

- 1c046e3: Keyboard focus is one contract across the DOM and the HUD. `@weasel-js/headless` adds `FocusScope<T>` (the focused target, whether its ring shows, `focus`, `moveFocus`, `tabOrder`, `subscribeFocus`) and the `tabSort` and `tabStep` rules behind it. `Hud` now extends `FocusScope<Widget>`, and `HudFocusOptions` is an alias of `FocusScopeOptions`; its behavior is unchanged, and `@weasel-js/hud` now depends on `@weasel-js/headless`. `@weasel-js/ui` adds `domFocusScope(root)`, the same contract over the elements under `root`, with the browser's Tab order.
- 11e2b7d: New package, `@weasel-js/headless`: a list's roving highlight and typeahead, generic over the item type. `rovingKey` moves a highlight on the arrows, Home and End, skipping items `canStop` refuses, for a vertical or horizontal list, with or without wrap; `typeaheadStep` finds an item by its typed prefix and cycles on a repeated letter. `@weasel-js/menu` now runs each menu level on them and depends on the new package; its own exports and behavior are unchanged.
- 3c3a219: `@weasel-js/headless` holds the arithmetic of moving items within a list, which ui's reorderable lists, trees, bars, tabs and token fields and diagram's reorder drags and Alt+arrow step now share: `moveItems`, `movedIndex`, `isNoopDrop`, `nudgeGap`, `gapByMidpoint`, `nearestGap`, and the Alt+arrow chord `isNudgeChord`/`nudgeOf`. A destination is a gap counted before the moved items are taken out, and a selection of several items moves in one go.
  
  ui's internal `movedOrder` now takes that gap rather than the entry's final index. A page tab no longer moves on Alt+Ctrl or Alt+Cmd with an arrow, only on Alt and an arrow, as every other reorderable list already did.
- 767713e: `@weasel-js/headless` holds the arrow-key step sizes and a slider's value math, so a DOM slider and a canvas-drawn one step alike. `arrowSteps`, `arrowMove` and `rangeKey` read a key string and Shift: one step, or `COARSE_STEPS` (ten) with Shift or a Page key, and Home and End for a range's ends. `sliderKey` is the value one key moves a thumb to, and `usableStops`, `attract` and `clampOrdered` are the stop and ordering rules `Slider` uses. core's node and anchor nudge and ui's `Slider`, curve, gradient, band and timeline editors all take their steps from it.
  
  `ResizeHandle` now moves ten steps with Shift held, not eight, matching every other arrow-key control in weasel.
- b59380e: Holding a step chip on a `@weasel-js/hud` canvas menu's number row now repeats, as a `@weasel-js/ui` number field's steppers do: one step on the press, then after 400 ms one every 60 ms until release, until the pointer leaves the chip, or until the value reaches its bound. The step now comes on the press rather than the release. `attachMenuHost` and `createMenuWidget` take `repeat` to time it.
  
  `@weasel-js/headless` exports `createStepRepeat`, the hold-to-repeat both run, with `REPEAT_DELAY_MS`, `REPEAT_EVERY_MS`, and `Scheduler` / `timerScheduler` for the clock it runs on; `@weasel-js/menu`'s `MenuScheduler` is now that `Scheduler`. `@weasel-js/quantity` exports `canSpin(key, from, bounds)`, whether a spin key moves a value anywhere, which `menuNumberCanStep` and `UnitField`'s steppers both use. This adds API.
- ba998f9: `@weasel-js/headless` adds `editEnd`, the one rule for how a text field's edit ends: Enter and blur commit, Escape cancels, with options for an Escape that commits and for a multiline field that leaves Shift+Enter alone. hud's menu text rows, ui's `MenuTextValue` and `RenameField`, and text-dom's `useTextEdit` now read it; none of them behaves differently. `@weasel-js/text-dom` now depends on `@weasel-js/headless`.
- 9a963cd: `@weasel-js/headless` has a tree's Right and Left as `treeKey(items, at, key, shape)`: Right opens a closed branch or steps to its first child, Left closes an open branch or steps to the parent. A `TreeShape` says which items are branches, which are open, which is whose child, and optionally which can't toggle. `rowKey(items, at, press, shape, searching)` is the rest of a list of rows' keys — Cmd/Ctrl+A, the arrows, Home and End with Shift to extend, the tree keys, Enter and Space, typeahead — returned as a `RowKeyAction` for the caller to carry out. This adds API.
  
  ui's `useRowNavigation` now takes every key but the Alt+arrow nudge from `rowKey`. Its keys do what they did before.
- 6cb0cf6: `@weasel-js/headless` adds `imeKey(e)`, whether a keydown belongs to an input method mid-composition: `isComposing`, or `keyCode` 229, which Safari sends for the Enter that ends a composition, or a `Process` or `Dead` key. This adds API. The hud's hidden text input, text-dom's `useTextEdit` and ui's `ComboBox` now use it in place of their own checks; `ComboBox` no longer commits typed text on Safari's composition-ending Enter, and `useTextEdit` also leaves `Process` and `Dead` keys alone.
  
  A context menu's text row and `PageTabs`' rename field leave Enter and Escape to an input method. Before, confirming a Japanese or Chinese candidate with Enter committed the half-typed text.
- 230a206: `rovingKey` takes `orientation: 'both'`, answering to all four arrows, and a `dir` that swaps Left and Right for a right-to-left layout (adds API). ui's `useRowNavigation` and `rovingTarget` now step through `rovingKey`; their behavior is unchanged.
- d5c4ee6: A tree's Left and Right mirror in a right-to-left list: `TreeShape` takes `dir`, and `rowKey` passes a list's own `dir` to it, so Left opens a branch and Right closes it under `'rtl'`. `COARSE_STEPS` now lives in `@weasel-js/quantity`, which `spinKey`'s Page Up and Page Down read, and `@weasel-js/headless` re-exports it as before.
- Updated dependencies [e974dba]
- Updated dependencies [30582cb]
- Updated dependencies [2999820]
- Updated dependencies [6d5f7c2]
- Updated dependencies [14f8583]
- Updated dependencies [783756a]
- Updated dependencies [b59380e]
- Updated dependencies [e7fca17]
- Updated dependencies [a58fb4f]
- Updated dependencies [8e6ed97]
- Updated dependencies [6b1b532]
- Updated dependencies [624cf38]
- Updated dependencies [9ef7751]
- Updated dependencies [2e4943e]
- Updated dependencies [8e2c8c8]
- Updated dependencies [0fc0e50]
- Updated dependencies [dc6f83a]
- Updated dependencies [97d889f]
- Updated dependencies [9adc0cd]
- Updated dependencies [d5c4ee6]
- Updated dependencies [24e03ff]
- Updated dependencies [b43c94c]
- Updated dependencies [dfdc8a6]
- Updated dependencies [e23101b]
  - @weasel-js/geom@1.14.0
  - @weasel-js/quantity@1.14.0
