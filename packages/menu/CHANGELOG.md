# @weasel-js/menu

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
