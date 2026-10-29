# @weasel-js/headless

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
