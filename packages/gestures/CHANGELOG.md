# @weasel-js/gestures

## 1.12.1

### Patch Changes

- @weasel-js/menu@1.12.1

## 1.12.0

### Patch Changes

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
- e9304f4: Keycaps draw a key's leader path. `formatShortcutParts` now returns `{ leader, keys }`: the keymaps
  leading to the key, outermost first, each with its label and its leader's chips, then the key's own
  chips as `KeyLegend`s, so an optional shift arrives marked. `formatShortcut` is built on it, and
  `SHORTCUT_LEADER_SEPARATOR` is the ` ▸ ` it writes. `KeySequence` takes a `leader` prop and draws each
  step's label before the keys (`Loupe ▸ 2`). `ShortcutKeys` takes a `shortcut` as data as well as a
  `legend`, and reads the leader path out of a legend `formatShortcut` wrote; `<KeymapHint>` and the
  command palette draw through them.
  
  Breaking: `formatShortcutParts` used to return a flat `string[]` of key labels. Its `keys` field is
  that list as `KeyLegend`s; read `.keys.map((k) => k.label)` for the old shape.
- Updated dependencies [dbd6711]
- Updated dependencies [c2fb65c]
  - @weasel-js/menu@1.12.0

## 1.11.1

### Patch Changes

- 411b629: A `carry` spec takes a `target`, matched against what is under the carry the way a click's is: a binding can now say "dropped onto a selected body" or onto an affordance. An immediate action with a target fires only on a release over it; an ongoing one starts on the first step over its target, as the carry comes over or as it moves on. The route grammar reads `carry(lab/*) => selected-body`. A carry's immediate params carry `affordance`, `bodyTarget`, and `bodyKind`.
  
  `Action.enabled`'s `carried` argument is now the exported `Carried` type and sees a carry too: `{ items: [], carry: { type, value } }`, so an action can refuse a payload it would not take.
- 995eac7: A double click, and a multitouch tap, are now timed by when their inputs happened rather than when
  each was handled, so a long task between a user's two clicks no longer drops the double click.
  `PointerSample` takes an optional `timeStamp` on the recognizer clock's timeline; the dispatcher
  passes each pointer event's own `timeStamp`. A sample without one, or with 0, or with one ahead of
  the clock (jsdom stamps events with `Date.now()`), is timed when it is handled, as before.
- 716561f: A `hover` spec takes `held`: `'optional'` keeps it firing while a button is down, `true` fires it
  only then, read the way `mods` reads a modifier. In a route it is `hover ?held` / `hover +held`.
  The binding still claims nothing, so a drag keeps its moves; a hover's params gain `held`.
  `useGestureDispatcher`'s `channels.hover` attaches hovers without the rest of the pointer channel,
  so no press opens a gesture or captures the pointer.
  
  The loupe now aims through the dispatcher (`loupe.aim`, `loupe.leave`) rather than listeners of its
  own, and still follows the pointer through a drag. `useLoupe` alone no longer aims: mount
  `<LoupeGestures>` with it, as `<TrialLoupe>` does.
- c497405: Add `KeyDiagram`, which draws a keyboard from a layout and groups its keys into `KeyBank`s the way
  the keyboard does — function row, main block, navigation cluster, arrows. Given `keys`, it draws only
  those, in their places, and shrinks to fit them; without a layout it draws them in a row, ungrouped.
  Keys in `held` light up, `marks` print what a key does under it and tint it, and `linger` hides the
  diagram until a key is held and for that many seconds after. `useHeldKeys` reads `held` off the
  keyboard.
  
  Layouts name keys by `KeyboardEvent.code`. `ansiLayout(platform)` and `KEYBOARD_LAYOUTS` give each
  platform's ANSI tenkeyless board, and `placeKeys` works out where a layout's keys sit. Gestures gains
  `keySpecFromCode`, the platform's legend for a physical key: `MetaLeft` is `⌘` on macOS and `⊞` on
  Windows.
- Updated dependencies [c2dfd4e]
  - @weasel-js/menu@1.11.1

## 1.11.0

### Patch Changes

- 95d22f1: `BodyClassification` now names the node it classified, as an optional `id`.
- cf7b009: A press that begins on one element and is released over a canvas is a gesture of its own, `carry` (`CarrySpec`), the in-app sibling of an OS drop. `startCarry(origin, pointerdown, { type, value }, callbacks)` opens one from any element; every dispatcher's element is a surface for it unless `channels={{ carry: false }}`, and the surface under the pointer dispatches it through its bindings. An ongoing action bound to `{ kind: 'carry', types }` starts as the carry comes over the surface and reads the payload from `ctx.carry`: moves update it, the release commits it, and leaving the surface or a canceled press cancels it. An immediate action fires on the release, with the payload in `params.carry`. `onEnd` tells the source whether a binding took the drop.
  
  labkit's palette drag-drop is a carry now, and a drop routes through the trial canvas's dispatcher beside its pan, zoom, and tap, as the `labkit.paletteDrop` action. This is breaking for a direct `useDragDrop` caller: it no longer takes `canvasContainerRef`, `view`, or `worldSpec`, and its result carries a `target` to render inside the `<CanvasStack>` the palette drops onto. A drop now lands only where nothing else on the page covers the canvas.
- 8ff3b4b: A double-click on a grouped member names its outermost group, so `modeTriggers` enters isolation on it, and repeated double-clicks drill one group further in each time. `<SceneCanvas isolatedGroup>` says which group isolation is working inside; a double-click names the outermost group below it, or the node hit where no group stands between them. `doubleClickTarget` is the one rule, applied by the canvas's body classification: `BodyClassification.doubleClick` carries the named node, a press carries it as `doubleClickBody` to the double click it completes, whose `kind:` targets match it, and the `hitAt` dep reports it as `doubleClick`. `enterPathEdit` stands aside when a double-click names a group. Single clicks are unchanged. Behavior change: a double-click on a grouped path used to open the path in path-edit.
- c6a0a52: Kit settings for gestures, targets, the camera, orbit and the loupe. Under a `<KitSettingsProvider>` a consumer can now set `gestures.doubleClickMs`, `doubleClickPx`, `longPressMs`, `tapPx` and `dragPx` (read by the dispatcher, the move action and `useDragHandle`; an explicit `longPress` prop or `dragThresholdPx` param still wins); core's `targets` leaves `handlePx`, `anchorHitPx` and `rotationDistancePx` (the base that device scaling multiplies, under an explicit `handleHitRadius`), `segmentHitPx`, `anchorClickPx`, `pickTolerancePx` (under `geometry.pickTolerancePx`), and the pen, bone, weight and slice overlay dot radii; `view.animationMs` (under a move's own `ms`); `orbit3d.orbitRate` and `dollyRate` in kernel3d; and `loupe.wheelRate` in labkit. `coreKitSettingsSchema`, `kernel3dKitSettingsSchema` and `labkitKitSettingsSchema` describe these as prefs groups whose paths are the settings' paths, each default being the existing constant. Underneath: `createPointerRecognizer` takes `doubleClickMs`, `doubleClickPx`, `tapPx` and `dragPx` thunks; `<SceneCanvas>` publishes the provider's store as the `kitSettings` dep; `targetSizesPx` and `mergeLayersWithDefaults` take optional base sizes; `createPenPreviewLayer`, `createBoneOverlay` and `createWeightOverlay` take optional size readers; `@weasel-js/react` declares `KitTargetSettings`, the shared `targets` area. Additive.
- da45b33: `MenuShortcut` is now the one shortcut shape, and `@weasel-js/gestures`' `ShortcutInput` is an alias of it rather than a wider copy: a key list naming spellings of one keycap, optional modifiers, and `shift: 'optional'`. A tool's `keybinding` can be a menu row's shortcut as-is. `@weasel-js/gestures` now depends on `@weasel-js/menu`, for that type only; menu still needs no React and no DOM. routing's `ActionShortcut` is the same type under a third name.
- 7947fdf: The shortcut formatters move from `@weasel-js/ui` to `@weasel-js/gestures`, beside `isApplePlatform`, so chrome that is not React can label a shortcut the same way: `formatShortcut`, `formatShortcutParts`, `keySpecsFromShortcut`, `keySpecsFromMods`, `keySpecFromKey`, `detectPlatform`, `MODIFIER_LABELS` and their types. `@weasel-js/ui` still exports every one of them. In gestures a key's legend is named `KeyLegend`, since `KeySpec` there is the key gesture; ui's `KeySpec` is now that type.
- Updated dependencies [90851d1]
- Updated dependencies [797bf34]
- Updated dependencies [fe20dc4]
- Updated dependencies [da45b33]
- Updated dependencies [57725cc]
- Updated dependencies [2f51085]
  - @weasel-js/menu@1.11.0

## 1.10.1

### Patch Changes

- 789e80d: A `hover` binding can ask for the pointer leaving. `HoverSpec` takes `motion: 'leave'`, written `hover(leave)` in a route: the binding then runs when the pointer passes out of what it targets, onto something its `target` does not match or off the surface, in place of on each move. With no `target` it runs only when the pointer leaves the surface. Its params are those of the move that took the pointer out, or of the last move before it left the surface. Additive: `hover` gains a `motion` arg in the route grammar that defaults to `move`, `HoverEvent` gains `from` and `off`, and `HoverWhere` is exported. A binding for a move and one for a leave on the same target no longer read as a conflict.
- 35c4879: One answer to "is a pointer held on this canvas". `heldPointers(element)` is new in `@weasel-js/gestures` (additive): it counts the pointers pressed on an element with any button and not yet released, and every reader of one element shares its listeners. The dispatcher's `hover` gesture and hover cursor, a layer's `onUncapturedMove`, and the `pointer` dep's published position all read it, where each used to track a press its own way.
  
  What changes: a move with a secondary or middle button held is no longer a `hover`; `onUncapturedMove` stays off until the last of several pointers is released, and through a `pointerleave` mid-press; and the `pointer` dep no longer reports a position for a drag that began outside the canvas and passed over the page.
  
  `giveKeys` (`@weasel-js/react/testing/giveKeys`) releases the middle-button press it makes.
- 9eefcc7: The READMEs of `@weasel-js/geom` and `@weasel-js/gestures` are overviews now: what is in the package, how its parts relate, and examples, where each used to be an install line and an empty import. Each links to its page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, which shows the README beside the package's guides, API reference, and demos. No code changed in either.

## 1.10.0

### Patch Changes

- 7063584: Fixes: a canvas with no binding for a drop was still a drop target. An OS drag over a `<SceneCanvas>` without the `ingest` preset showed the copy cursor and the `weasel-dropover` class, and the drop was swallowed with nothing inserted. `useGestureDispatcher` now asks its bindings on each `dragover` whether one would take a drop of what the drag carries, and only then cancels the event and adds the class. A drag nothing would take is left to the page.
  
  This is a behavior change, decided on an agent's judgment: the question is answered per drag, by the bindings, with no new channel flag. A consumer's own `drop` binding makes the canvas a drop target without the `ingest` preset, and a binding typed `drop(image/*)` refuses a drag of plain text. A file whose type the browser withholds until the drop (Firefox names it `application/x-moz-file`) is accepted while it hovers.
  
  Adds API: `UNKNOWN_MIME` in `@weasel-js/gestures`, the MIME of an item whose type is not known yet, which `matchIngestTypes` lets through every glob; and `itemTypesFromDataTransfer` in `@weasel-js/routing`, what a drag in flight says it carries.
  
  Changes API: `SceneCanvasApi.ingest()` returns a boolean, where it returned nothing. `false` means the canvas had no `ingest` action to run, which was a silent no-op before; it also warns under the `ingest` debug namespace.
- a275f78: Adds API: a `hover` gesture, the pointer moving with no button pressed. `{ kind: 'hover', target?, mods?, phase? }` (`HoverSpec`) binds an immediate action that runs on every such move with `worldX` / `worldY`, `clientX` / `clientY`, `affordance`, `bodyTarget`, and `mods` in its params; `hover` is a route-grammar gesture name, and `HoverEvent` joins `InputEvent`. A coordinate readout, an eyedropper preview, or a ruler can follow the pointer through the dispatcher, with its modifiers, targets, modes, and views, where each used to attach its own `pointermove` listener.
  
  A hover binding claims nothing, a rule chosen on an agent's judgment: every live `hover` binding that matches a move runs, the move is never canceled, and it still reaches the hover-cursor pump. An ongoing action bound to `hover` is refused with a console error, since there is no press for it to own. A held pointer's moves are its drag's and fire no hover. The gesture reports motion only; it does not say when the pointer leaves.
  
  Adding a member to `GestureSpec`, `InputEvent`, and `GestureName` breaks a consumer's exhaustive `switch` or `Record` over any of them.
- 1ce19c9: Fixes: a tool hotkey fired while a `<select>` had focus, under the select's own type-ahead. The dispatcher now leaves a select its printable characters and its arrow, Home, End, and Page keys, and still takes Delete, Escape, and every modifier chord typed on one, so Cmd+Z works with focus resting on a select.
  
  Changes behavior: `BandEditor` and `Timeline` asked their own question about a key's target, which counted a `<select>` as a text field. They now ask the dispatcher's, so Delete on a select inside a band merges the band, and Delete on a select inside a `Timeline` deletes the selected key. `x` and `l` on a select in a band are still the select's. This rule for `<select>` was chosen on an agent's judgment.
  
  Adds API: `focusedControlOwnsKey(e)`, exported from `@weasel-js/gestures`, `@weasel-js/routing`, and `@weasel-js/core`: whether a key belongs to the control it was typed on. `isEditableTarget` and `activatesFocusedControl` now live in `@weasel-js/gestures` and are re-exported where they were.
- c0f1190: Adds API: the `MultiTouchGeometry` type, which `multiTouchGeometry` already returned: the pointers' centroid, and the first two's spread and angle.
- b3d4383: Additive: `InvocationCtx.multiTouch.rotation` is real. It was always 0; it is now the degrees the two primary fingers have turned since the gesture began, clockwise positive, and it keeps counting past a half turn. `MultiTouchEvent` carries the `angle` it is computed from, and `multiTouchGeometry` returns it beside the centroid and spread. An action that read `rotation` and relied on the 0 now sees the turn.
- 54b013c: Removes what was left of tools running their own gestures. A tool declares bindings to actions, and nothing called these any more.
  
  Breaking, for code that used them:
  
  - `ToolCtx` is gone from `@weasel-js/routing` and `@weasel-js/core`. An action reads its `InvocationCtx`.
  - A function passed as `Tool.cursor` or `ToolDef.cursor` takes no argument: the type is `CursorSpec | (() => CursorSpec)`. A cursor that depends on the tool's state closes over that state. Before, the function was handed a context whose pointer position was always `0, 0` and whose modifiers were always up.
  - `Tool.previewPose`, `Tool.previewBounds`, and `Tool.previewIds` are gone, and a canvas no longer asks its tools for a preview. An in-flight preview comes from the action's `OngoingHandle` (`previewIds`, `previewPose`, `previewData`), which is where the kit's actions publish theirs. `CanvasHelpers.getPreviewSources()` returns those handles alone.
  - `Tool.initScratch` and `ToolDef.initScratch` are gone, and so is `ToolLifecycleCtx`. `onActivate` and `onDeactivate` take no argument; before, they were handed `{ scratch }`, the value `initScratch()` returned. A tool that keeps state between gestures holds it itself and closes over it, as the pen does.
  - `Tool`, `ToolDef`, and `defineTool` lose their scratch type parameter. In `@weasel-js/core` none of them takes a type argument: `Tool<null>` becomes `Tool`, and `defineTool<null>({ … })` becomes `defineTool({ … })`. In `@weasel-js/routing` the one parameter left is the overlay type: `Tool<TOverlay>`, `ToolDef<TOverlay>`, `defineTool<TOverlay>`.
  - `AnyToolOf<TOverlay>` is gone from `@weasel-js/routing`; `Tool<TOverlay>` is the same type.
  - `ToolPresentation` takes no type parameter, and a function passed as `presentation.icon` takes no argument. The palette only ever called it with `undefined`.
  
  Adds API: `CanvasExtensionApi.clientToWorld(clientX, clientY)` converts a client point to the canvas's world the way the canvas itself does, through the `clientToWorld` prop when one was given. Fixes a `<Canvas>` given that prop disagreeing with itself: hover used the override, and the test for whether a registered layer covers a point inside a `<CanvasView>` did not.
- a8ef308: The three drag ghosts mount in one place. `fixedSeat(from)` in `@weasel-js/gestures` answers where a `position: fixed` element following the pointer mounts (the nearest themed or `data-wzl-portal-host` ancestor of `from`, else the body) and the client point its corner lands on when that host contains its fixed descendants. `nearestPortalHost` moved there from ui, which still exports it.
  
  - core: the default `useDragHandle` ghost mounts in the source's host, where it mounted on the body, so it resolves the source's theme and draws in its font.
  - ui: `<DragGhost>`'s `at.width` is optional; with none the ghost is as wide as what it holds.
  - labkit: a palette drag's ghost is ui's `<DragGhost>`, so it takes the lab's theme. **Breaking:** `DragState` and `DragGhostProps` gain a required `from`, the element the drag began on, and the ghost loses its own border.
- 1c8c3fc: Pointer gesture recognition moved out of `useGestureDispatcher`'s effect into `createPointerRecognizer` in `@weasel-js/gestures`. It takes pointer samples and a clock, and emits `InputEvent`s to a sink: the press and the drag it becomes past `DRAG_THRESHOLD_PX`, click, double click, long-press with its contextmenu fallback, and multitouch start, move, end, and tap. It has no DOM, so its timings can be tested with a fake clock.
  
  Additive in `@weasel-js/gestures`: `createPointerRecognizer` and its types, `clickEvents`, `longPressEvents`, `multiTouchGeometry`, `stylusOf`, and the thresholds `LONG_PRESS_MS`, `DOUBLE_CLICK_MAX_MS`, `DOUBLE_CLICK_MAX_PX`, and `TAP_THRESHOLD_PX`. `@weasel-js/routing` still exports `LONG_PRESS_MS`, and adds `multiTouchGestureId` beside `pointerGestureId`.
  
  What a consumer of `useGestureDispatcher` can observe:
  
  - `requestRedraw` follows the dispatcher's own notifications. It now also fires when a gesture in flight is ended or stepped by something other than an input event through the hook: the cancel a tool switch makes, `Dispatcher.cancelAll`, a UI-driven ongoing action. A canceled marquee no longer stays painted until the next redraw.
  - A double click is timed on `performance.now()`, as long-press and multitouch tap already were, where it used `Date.now()`.
  - The platform that decides whether `mod` means Command is read when the hook mounts, not when the module loads.
  - The hover cursor's `keydown`/`keyup` listeners on `window` attach only when the pointer channel is on.
  - A click is decided by whether the press crossed the drag threshold. The hook used to also ask whether a `pointer-<id>` handle was in flight; nothing the hook does opens one before the threshold, so only code calling `handleInput` on the hook's dispatcher with its own pointerdown could have seen the difference.
  
  Tool `onActivate` / `onDeactivate` run from their own hook beside the tool registry, in the same order as before: the outgoing tool's `onDeactivate`, the cancel of in-flight gestures, then the incoming tool's `onActivate`.
- 90f8ec4: Adds API: types that documented exports already named, and that a consumer could not import, are now exported. `@weasel-js/core`: `CameraProps`, `CanvasViewState`, `CanvasLayers`, `SceneSlotLayers`, and `OpsApplier`. `@weasel-js/animator`: `Naming`. `@weasel-js/gestures`: `Point`. `@weasel-js/ui`: `LiveControl`, `OnTokenChange`, and `OptionKey`, the `string | number` a `Select`, a `ComboBox`, and `useAsyncOptions` each declared privately as `Key`.
  
  Adds API: `strokeRegion` in `@weasel-js/core`, the region a stroke covers along a path, which `applyOutlineStroke`'s documentation pointed at and `StrokeRegionOptions` already described.

## 1.9.4

### Patch Changes

- d8ba470: Documentation only. `ModSpec` said only `shift` accepts `'optional'`; every modifier does. `DoubleClickSpec` quoted 500 ms and 5 px; the dispatcher uses 600 ms and 8 px. `TargetPredicate` said `hit` is the DOM target for gestures other than drag; it is the affordance hit for every gesture. `ActionsRegistry.activate` said a dispatcher activates its scope on focus; it does so on pointerdown and wheel.
- 7c2e054: A key binding can name the physical key. `KeySpec` and `KeyHeldSpec` take a `code` (`KeyboardEvent.code`, one or several), tried before `key`, with either one matching; key input events carry the code. Bring to Front and Send to Back on Cmd+Alt+] and Cmd+Alt+[ use it, so they fire on layouts where Option makes those keys type something other than the US glyphs. A held key is now tracked by its code, so with both Shift keys down, releasing one no longer ends a Shift hold.
- 5a92802: `mod` is matched and drawn from one platform read. `@weasel-js/gestures` exports `isApplePlatform()`; the gesture dispatcher uses it for the `isMac` it matches with, and ui's `detectPlatform` uses it to pick key legends. `formatShortcut` and `formatShortcutParts` now follow the platform, taking an optional `{ platform }`: off macOS a `mod` shortcut reads `Ctrl+Z`, not `⌘Z`. Behavior changes: on iPhone and iPad the dispatcher now matches `mod` on Command where it matched Ctrl, and `detectPlatform` reads an unrecognized browser as Linux where it read macOS. ui gains a dependency on `@weasel-js/gestures`.
- 7536ff8: Lifting one finger of a pinch committed every gesture in flight, so a drag started by another finger ended mid-drag and a held Space released its tool. A three-finger gesture whose fingers lifted one at a time was never ended at all, and neither was a pinch one of whose pointers was canceled. `useGestureDispatcher` now ends the multitouch gesture alone, on the first finger to lift (`'commit'`) or be canceled (`'cancel'`). `MultiTouchEvent` gains an optional `end` field, which is how the dispatcher is told.
- 9842451: A `multiTouchTap` binding no longer fires after a long hold. Fingers that rest in place for as long as a long-press takes (500 ms, or the dispatcher's `longPress.duration`) and then lift are not a tap.
- 62d3561: The route-conflict check compares two kinds of tie it used to miss. A binding with an optional modifier is now compared with one that forbids it, since both take the bare press at equal rank: `ArrowLeft` with `shift: 'optional'` against plain `ArrowLeft` is reported. And `multiTouch` is a route gesture, written `multiTouch(2)`, so two bindings on the same finger count are compared, `routesForSpec` prints one, and `routeToSpec` parses it.
- 8d56051: A `kindOf` target predicate must now declare whether it reads the affordance hit: `TargetPredicate.readsAffordance` is required, and the exclusive-claim filter reads it and no longer guesses. Build one with the new `hitPredicate((hit, bodyTarget) => …)` or `bodyPredicate((bodyTarget) => …)`, exported from `@weasel-js/gestures` and `@weasel-js/core`. This is a breaking change: a bare function as `kindOf` is a type error, and one passed from untyped code counts as not reading the hit, so an exclusive claim bars its binding.

## 1.9.3

No changes in this release.

## 1.9.2

No changes in this release.

## 1.9.1

No changes in this release.

## 1.9.0

No changes in this release.

## 1.8.1

### Patch Changes

- 934f195: The gesture dispatcher no longer takes a press that lands on a control inside its host — a button, field, link or anything with a control role. It used to open a pointer session that captured the pointer, so the browser delivered the click to the host instead, and a button laid over a canvas (labkit's instrument overlay, for one) could not be clicked with a real pointer. `isInControlWithin` and `CONTROL_SELECTOR`, which answer that question, move from weasel-ui's internals to `@weasel-js/gestures`, re-exported by routing and core.
- f9c137b: `MultitouchEvent` and `MultitouchTapEvent` are renamed `MultiTouchEvent` and `MultiTouchTapEvent`, matching `MultiTouchSpec` and every other event and spec type. The old names are gone; an import of either needs the new spelling. The event kinds stay `'multitouch'` and `'multitouchtap'`, lowercase like `'doubleclick'` and `'longpress'`.

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

- 9647b3c: `routeToSpec` turns a parsed route into the `GestureSpec` it describes, so a route string can drive `matchSpec` directly. It throws on a route no spec can express: `keyUp`, a key or finger-count wildcard, or a target that is not a target form.
  
  `specificity` now lives in `@weasel-js/gestures` beside the matcher. `@weasel-js/routing` and `@weasel-js/core` still re-export it.
  
  `describeRoute` reads two or more required modifiers as a held chord ("the user holds Mod and Alt and drags anywhere") rather than "the user Mod and Alt-drags anywhere". It also names the modifiers on multi-finger taps, drops and pastes, which it used to leave out; puts the target on wheel routes; and says "long-presses" for `longPress`.
- ca2f45f: Every click-versus-drag decision in the kit now reads one threshold, `DRAG_THRESHOLD_PX` (4 CSS pixels), through `pastDragThreshold`. Both now live in `@weasel-js/gestures`; `@weasel-js/routing` and `@weasel-js/core` re-export them as before. `useDragHandle` starts a drag at 4px instead of past 5px, labkit's `FloatingPanel` and the hud window's content click at 4px instead of 3px, and `startThresholdDrag`, `useReorderDragList` and `Select` default to the constant rather than their own literal 4.
  
  The move action's `dragThresholdPx` option works again: set as `selectTool.move.dragThresholdPx` on `<SceneCanvas>`, it holds the selection in place until the pointer has travelled that far on screen. It has been ignored since the `useMove` hook was removed. It cannot lower the threshold below the dispatcher's.
- 242e9f7: `routeGestureForSpecKind` and its inverse `specKindForRouteGesture` now live in `@weasel-js/gestures`, read from one table; `routeToSpec` and routing's route registry both use it. `@weasel-js/routing` and `@weasel-js/core/routing` re-export both.
  
  Every routing type with an overlay parameter — `Tool`, `ToolDef`, `ViewportToolDef`, `Contribution`, `ContributionChrome`, `useTools` and `useContributions` with their option and result types — now defaults it to the kernel's overlay type (`KernelOverlay`), as `defineTool` already did. Under core that is `RenderLayer`, so a routing `Tool<S>` fits `<SceneCanvas tools>` without naming the overlay. Functions that read tools without reading overlays (`buildRouteRegistry`, `findConflicts`, `reportRouteConflicts`, the dispatcher's `toolsById`) take any overlay explicitly.
- f8f6041: A binding with no `phase` now prints as `[*:*]` rather than `[*]` in `routesForSpec`, conflict messages and the dispatch record. `[*]` is shorthand for `[&:*]`, which an ambient binding never matches and which ranks higher on phase, so a route copied out of the inspector used to describe a different binding from the one it was printed from. `routeToSpec` now reads `[*:*]` as "no phase" and keeps `[*]` as the `&:*` atom it abbreviates; a route string that relied on `[*]` meaning "no phase" should say `[*:*]`.

## 1.6.1

No changes in this release.

## 1.6.0

### Patch Changes

- 97561f1: Zoom the canvas on Safari's trackpad pinch
  
  Safari reports a trackpad pinch as WebKit `gesturestart` / `gesturechange` /
  `gestureend` events, and nothing listened for them, so the page zoomed instead
  of the canvas. `useGestureDispatcher` now dispatches each `gesturechange` as a
  new `pinch` gesture: `PinchSpec` (`{ kind: 'pinch', direction?: 'in' | 'out' }`),
  `PinchEvent`, route-grammar name `pinch`, and `InvocationCtx.pinch`. Safari's
  cumulative `scale` is turned into a per-sample step, and the focal point is
  canvas-local like a wheel's. A new `pinch` entry in `DispatcherChannels` turns
  the listeners off.
  
  `viewport.zoom` binds it. Its wheel and pinch samples now share one path: each
  becomes a scale factor about a focal point, so a pinch sample of 1.1 lands on
  exactly the view a ctrl+wheel `deltaY` of -100 does.
  
  Safari can send the same pinch as ctrl+wheel too. While a pinch some binding
  has claimed is live, the dispatcher swallows ctrl+wheel (preventing its
  default, dispatching nothing), so one pinch zooms once. When no binding claims
  the pinch, the gesture events are left to the browser and ctrl+wheel reaches
  its bindings as before.

## 1.5.2

### Patch Changes

- 24a2dae: Close the places where two tiers spelled one concept differently.
  
  **A fixed pan bug.** `viewport.dragPan` fell back from `drag.screenDelta` to
  the world `drag.delta` and then divided by the zoom anyway, panning at
  1/scale² for any event source that supplies no `clientX`/`clientY` — which is
  every synthesized `InputEvent`, since those fields are optional. It now
  reconstructs the client delta exactly, by undoing each end of the world delta
  against the view that produced it.
  
  **Breaking, renames.** `ClickEvent`, `DoubleClickEvent` and `ContextMenuEvent`
  carry their world point as `x`/`y`, matching every other kind in `InputEvent`;
  `worldX`/`worldY` are gone, and a consumer who set `x`/`y` no longer silently
  lands at the origin. All three now also carry `clientX`/`clientY`, so a
  context-menu action can finally read `ctx.screen` — the case that surface was
  added for. The renderer's `Mat3` is `GlMat3`, freeing `Mat3` to mean geom's
  affine in a file that imports from both. `translatePolygonInPlace` is
  gone: it was the one sanctioned writer into a committed path's coord buffer,
  documented as overlay-only, and nothing called it. `@weasel-js/font` exports `FontStyle`
  in place of `OutlineFontStyle`. `@weasel-js/labkit` no longer exports
  `useOrbit`, `OrbitView`, `Vec3` or their helpers: `@weasel-js/kernel3d` owns
  the orbit camera and `@weasel-js/geom/3d` owns `Vec3`. `ToolCtx.screenPoint`
  was declared and never written by anything; it is gone.
  
  **Breaking, types narrowed.** geom's `Mat3` and `Box` are readonly tuples,
  matching the reason `geom/3d` already gives for its own. `History.entries()`
  returns `readonly` arrays, which is what its docstring always asked callers to
  assume.
  
  **One type where there were two.** `@weasel-js/svg`'s `Matrix` is geom's
  `Mat3`, and its duplicate `multiply` is geom's; `SvgStroke.width` is
  `ScreenLength` rather than that union written out again. `kernel3d`'s
  `ViewportRect` is `ScreenBox` — one rectangle spelling instead of `w`/`h`
  beside `width`/`height` eight lines apart. The renderer's `View` is routing's.
  Core's `Vec2` is routing's `Point2`, and `Pt` is gone from the barrel.
  
  **Additions.** `oklchDegToHex` / `hexToOklchDeg` / `OklchDeg` in
  `@weasel-js/paint` — the degrees-and-hex form `@weasel-js/ui` and
  `@weasel-js/theme` had each built for themselves. `srgbFloatToOklab`, for
  callers holding 0..1 floats; feeding those to `srgbU8ToOklab` truncated where
  paint's own internal conversion rounds. `mat3.toAffine` / `mat3.fromAffine`
  name the repack between the GL layout and geom's.
  
  **Corrections.** `RECT_POSE_DESCRIPTOR` implements `getRotation`, so a pose it
  rotated no longer reports itself unrotated to `useResize` and to diagram's port
  placement. `ToolDef.capabilities` is documented as reaching
  `Tool.eligibility.capabilities`, which is where it actually goes — following
  the old text gave `undefined`, and `eligibleForMode` turns that into a tool
  that vanishes from every mode. `MultitouchEvent.centroid` is documented as
  canvas-local, which is what the dispatcher hands over. `drag.points` is a
  snapshot on `onEnd` rather than the dispatcher's live accumulator.
  
  `tsconfig.json` now typechecks `packages/routing`, `cursor`, `bidi` and
  `loupe`, which it had never included.

## 1.5.1

## 1.5.0

### Patch Changes

- ef60ff6: The routing layer's types now state where the dispatch boundary runs, instead of leaving it implicit inside two large interfaces.
  
  `Action` splits into `ActionDispatch` — bindings, deps, invoker, scope, gates, cursors — and `ActionPresentation`: label, icon, group, shortcut. `Contribution` splits the same way into `ContributionRouting` and `ContributionChrome`. Both composed types keep every field they had, so nothing that authors an action or a contribution changes.
  
  New alongside them: `BindingSource`, the id-plus-`defaultBinding` shape `actionBindings` reads; and `ActionSource`, the single `list()` method the gesture dispatcher consults a registry through. `actionBindings`, `BoundGesture`, `evaluateEnabled`, `ActionEnabledResult`, `SliceDep`, `ClipboardDep` and `TextEditDep` are re-exported from the same barrel entries as before, from new homes. `ClaimableGesture` now lives in `@weasel-js/gestures` beside `GestureName`, and is still exported from `@weasel-js/core`.
  
  `_resetEnabledWarnsForTests` is removed. It had no callers and was never on the public barrel.
  
  Under this, core's import graph loses a 15-file strongly connected component spanning contributions, tools, actions, the dep schema and the dispatcher. Nothing in routing, tools or contributions is in an import cycle now.
  
  The consumer smoke test gained a check that a consumer's own `declare module '@weasel-js/core'` dep merges into `DepSchema` against the published declarations, and stopped reading a subpath import such as `@weasel-js/geom/booleans` as an undeclared package.

## 1.4.4

## 1.4.3

## 1.4.2

## 1.4.1

## 1.4.0

## 1.3.0

### Patch Changes

- 20097e6: Declare `sideEffects` on the five packages that were missing it, so bundlers
  can tree-shake unused exports instead of assuming every module does work at
  import time.
  
  `gestures`, `history`, `modes`, and `hud` are `false` — none of them touch a
  global or run anything at module scope. `labkit` is `["*.css"]`, matching
  `ui` and `theme`: its JS is side-effect-free, but a blanket `false` lets a
  bundler drop the `@weasel-js/labkit/styles.css` import a consumer wrote by
  hand, and the page then renders unstyled with no error anywhere.

## 1.2.0

## 1.1.0

## 1.0.4

### Patch Changes

- bd42540: Fixes seven correctness faults found by review of the pure-logic packages.

  **geom.** `pathToMultiPolygon` handed every ring to `polygon-clipping` as its
  own polygon, and the polygons of a MultiPolygon are unioned — so a path with
  holes arrived at the clipper solid, and the path's `fillRule` was never read at
  all. Rings are now grouped into outer + hole polygons by containment, under
  either fill rule. `flattenCubic` could not terminate on a non-finite control
  point or a non-positive tolerance; it now treats a non-finite deviation as flat
  and caps subdivision at 16 levels, which is far beyond what any terminating
  call reaches, so flattened geometry is unchanged. `approxEq` called every
  finite number equal to an infinity while calling two identical infinities
  unequal. `invert` judged the determinant against an absolute epsilon, rejecting
  a well-conditioned uniform 1e-7 scale while accepting a large matrix whose
  determinant is pure cancellation; the test is now relative to the squared
  column norms, and a non-finite matrix returns null instead of NaNs.

  **history.** Coalescing merged into whatever entry the undo stack left on top,
  so an edit made after an undo could rewrite an older entry in place — leaving
  one entry, still under the older label, that a single undo stepped past. A
  merge target is now the entry the last push created and nothing else.
  `resumeJournal` ignored which journal was active, letting two journals write to
  the same adapter with independent inner histories; it now refuses while another
  is active.

  **gestures.** `parseRoute` fills an omitted arg slot with the `'*'` wildcard for
  gestures whose descriptor declares no default. `formatRoute` re-emitted it
  (`[*:*] drop` came back as `[*:*] drop(*)`, so format ∘ parse was not
  idempotent) and `describeRoute` printed it literally ("the user drops \* content
  onto the canvas"). Both now treat it as the wildcard it is. `LongPressEvent` and
  `LongPressSpec` — the one arm of the public `InputEvent` / `GestureSpec` unions
  the barrel never named — are exported.

## 1.0.3

### Patch Changes

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

## 1.0.2

### Patch Changes

- d2a9049: Six backlog entries, all in the input and hit-test layers.

  Tool overlays can say where they sit. `Contribution.overlay` takes a
  `RenderLayer` or an array of them, and a new `overlayPosition` (`'top'` — the
  default — / `'before-selection'` / `'after-selection'`) anchors them against
  the selection chrome instead of always landing on top; with no selection layer
  in the stack the anchored positions fall back to the tail.
  `getActiveOverlays(position?)` partitions, and `placeToolOverlays` in
  `canvas/layerOrder.ts` does the splice, so the ordering is testable without a
  GL context.

  `drop` and `paste` are route-grammar gesture names. They shipped without them,
  so the inspector reported `undefined` for every ingestion binding. Both are
  targetless and carry the spec's MIME-glob filter as their arg — `drop(image/*)`.

  An unhandled paste stays the page's. `onPaste` now dispatches first and calls
  `preventDefault` only on `'handled'`, the shape `onWheel` already used.
  Clipboard items materialize synchronously, so unlike `onDrop` the result is
  known while the default can still be suppressed.

  Marquee and lasso see the shape a node actually draws. `hitTestArea` asked the
  _pose_ for a silhouette, which meant the kit's own inserted shapes — geometry
  on `node.data.path` behind a plain `{x,y,w,h}` pose — took the AABB path and
  kept every false positive the silhouette test exists to drop. It now asks
  `findShapeSilhouette` for the drawn world-frame boundary. Paying for that is a
  containment short-circuit: a node the rect marquee swallows whole is a hit no
  silhouette can overturn, so neither the kernel nor the painter runs. Net
  against the committed bench baseline, polygon-pose scenes gain (1.25x at 1000
  nodes / 100% area) and plain-rect scenes lose ~8% on the two rows that scan
  everything. The short-circuit is marquee-only, behind `hitTestAreaPolygon`'s
  `areaIsRect` flag, because a node inside a lasso hull's bounding box can still
  miss the hull.

  Layout siblings reflowing mid-drag render opaque. `OngoingHandle.previewOpaqueIds()`
  names the subset of `previewIds()` that skips the ghost alpha; `moveAction`
  fills it from the destination and source reflow ids. A ghost means "in flight
  under the pointer", which a sibling settling into its destination slot is not.

  `LayoutStrategy.acceptsDrop(container, dragged)` rejects a drag before any
  drop-target work, so a type-aware container falls through to whatever sits
  under it rather than swallowing everything in its bounds.

  `flipAction` reads `params.pivot`. `'each'` (the default, unchanged) mirrors
  every pose about its own AABB; `'union'` mirrors about the selection envelope
  so items swap sides, and the `geometryProjection` data op follows the same
  pivot.

## 1.0.1

### Patch Changes

- e367165: One enumeration of the `TargetSpec` forms. `@weasel-js/gestures` now exports
  `parseTargetSpec`, which resolves a target spec to a discriminated
  `TargetSpecForm` (`body` / `kind` / `affordance` / `predicate`), and the three
  places that used to re-derive the string prefixes independently — `matchTarget`,
  and `targetRank` / `targetConsultsAffordance` in core's dispatcher matcher —
  switch on it exhaustively. Adding a form to `TargetSpec` is now a compile error
  at every site that has to handle it.

  For consumers: `matchTarget`'s `specTarget` parameter and core's
  `targetConsultsAffordance` take `TargetSpec | undefined` instead of `unknown`,
  so a target string that is no known form is a type error rather than a silent
  no-match. The predicate form has a name, `TargetPredicate`, carrying the
  `readsAffordance` flag the exclusive-claim filter reads. Runtime behavior is
  unchanged.

## 1.0.0

### Minor Changes

- 40dd97d: A widget declares which gestures it consumes, and a claim bars only those.

  A HUD widget could be pressed, dragged and hovered and nothing else. The gap
  was in the dispatcher: `affordanceAt` ran on `pointerdown` and hover only, so
  `doubleclick`, `contextmenu` and `wheel` carried no affordance and no binding
  could gate on one. All four now do — `doubleclick` replays it from its press,
  `contextmenu` classifies its own position (a secondary button never reaches
  `onPointerDown`, so there is nothing to replay from) and gains world
  coordinates it never carried, and `wheel` classifies the point under the
  cursor. The immediate-invoker param bag, which forwarded position for `click`
  and `pointerdown` only, now covers `contextmenu`, `longpress` and the
  affordance on all four.

  **Behavior change, and the reason for the rest of this entry.** An exclusive
  claim previously meant _this pixel is mine_. Under that rule, giving `wheel` an
  affordance would have killed scroll-to-zoom over every floating panel. It now
  means _these gestures are mine_: `LayerHit` and `AffordanceHit` gain
  `claimedKinds`, a set over the new `ClaimableGesture` union (`'pointer'` —
  covering `pointerDown` / `click` / `drag`, one press protocol — plus
  `'doubleClick'`, `'contextMenu'`, `'longPress'`, `'wheel'`). Omitting it bars
  everything, which is what an exclusive claim did before.

  `Widget.claims` is that set. Absent means every kind but `wheel`, so
  right-clicking or double-clicking HUD chrome stops acting on the scene
  underneath while scroll-to-zoom over a panel is unchanged; a widget that wants
  the wheel asks for it. `claims: []` is decoration and replaces `claimsPointer`,
  which is removed. `HudPointerEvent` gains `doubleclick`, `contextmenu`,
  `longpress` and `wheel` arms.

  `PointerClaim` and `onPointer`'s return type are removed. The return was
  discarded at every call site, and it cannot be made live: the claim filter runs
  at match time, before any widget is consulted, so there is no later moment at
  which returning `'pass'` could restore a binding the filter already dropped.

  **Two matcher fixes this depends on.** `doubleClick` and `contextMenu` passed
  the DOM target to `matchTarget` where `click`, `drag` and `longPress` pass the
  affordance; a `kindOf` predicate on either kind therefore received an element
  no predicate in the kit expects. They now match the others. And the kit's body
  predicates — `isBody`, `isSelectedBody`, `isUnselectedBody`, `isEmpty` — carry
  `readsAffordance: false`, which `targetConsultsAffordance` honors. Each has a
  `kindOf` but reads only `bodyTarget`, so the filter inferred that they consult
  the hit and let them survive a claim; with `doubleclick` now carrying one,
  `enterPathEdit`'s `kindOf: isBody` would otherwise have entered path-edit mode
  on a double-click over chrome.

  `WheelSpec` gains `target`, and `wheel` gains a route-grammar target slot —
  a wheel binding could not gate on anything at all before.

## 0.8.0

### Minor Changes

- e0ab60e: Device profile: the kit stops assuming a mouse.

  `DeviceProfile` is one object holding pointer coarseness, hover capability and
  pixel density, resolved once per `<SceneCanvas>` and published to its subtree.
  Two things read it. The chrome-caps rule layer gains `coarsePointer:` and
  `canHover:` selectors (plus matching fluent atoms), so consumers can gate
  chrome on the device. And every handle size and hit radius — six independent
  literal `8`s and one `24` before this — now derives from one base module times
  `DeviceProfile.targetScale`, so a coarse pointer gets 14px handles and a 42px
  rotation distance without paint and hit-test ever drifting apart. The public
  `DEFAULT_HANDLE_SIZE` / `DEFAULT_ROTATION_HANDLE_DISTANCE` constants keep
  their unscaled values.

  `longPress` is a real gesture kind: spec, event, matcher, and route grammar.
  The dispatcher synthesizes it for touch and pen presses held 500ms without
  crossing the drag threshold — never for a mouse, and cancelled by movement,
  release, cancel, or a second finger landing. An unmatched long-press
  re-dispatches as `contextmenu`, so existing `contextMenu` bindings become
  reachable by touch with no consumer change.

  Also fixes a density bug: `useCanvasSize` read `devicePixelRatio` only inside
  its `ResizeObserver` callback, so moving a window to a different-density
  display without resizing it left the snapshot stale. Density now comes from
  the profile, which watches a re-armed resolution media query.

  Override any of it with the new `<SceneCanvas device={{ coarsePointer: true }}>`
  prop — for tests, for demos that want touch-sized chrome on a desktop, and for
  hybrid devices where the media query guesses wrong.

## 0.7.2

### Patch Changes

- 8bc719a: Every package now declares `engines.node: ">=22"`, up from `">=20"`. Node 20
  reached end of life on 2026-04-30, so the old floor advertised support for a
  runtime that no longer receives security patches — a claim in each published
  tarball that had quietly stopped being true. `@weasel-js/labkit` had no `engines`
  field at all and now matches its siblings.

  Nothing in the kit required a Node 20 feature, so this changes what is promised
  rather than what runs. CI tests both ends of the range: the 22 floor and the 24
  Active LTS the release and docs workflows build on.

## 0.7.1

## 0.7.0

## 0.6.0

## 0.5.1

## 0.5.0
