# @weasel-js/routing

## 1.7.0

### Patch Changes

- 6819653: The route-conflict check now compares actions gated by different `eligible` rules, where it used to assume they never hold together. Two such actions on one route conflict when some mode lets both rules hold and the rules don't exclude each other. The modes are the kit's `DEFAULT_MODES` unless `findScopedConflicts` / `reportRouteConflicts` is given a `modes` list. `ruleCanHoldIn(rule, mode)` answers the per-mode question, and `activeModeOf(definition)` in `@weasel-js/modes` builds the `ActiveMode` it reads — the same shape `getActiveModeFor` returns, which now uses it.
- af5281e: The route-conflict check now reads a binding's `opts.views`. A view-scoped binding and an unscoped one on the same route never tie — outside its views the scoped one is not live, and inside them it outranks the unscoped one — so the check no longer warns about them; two bindings scoped to overlapping views still conflict. This silences the warning `createMinimapContribution`'s drag raised against `viewport.dragPan`. `RegistryEntry` gains an optional `views`.
- 240138b: "Tool" now names only a contribution that can hold focus — one a user picks from a palette or holds on a key — and `isTool(entry)` is the test. What holds every kind of entry takes `Contribution` and says "entry":
  
  - `useGestureDispatcher`'s and `DispatcherContext`'s `toolsById` is `entriesById`, a map of `Contribution`.
  - `ownerToolId` is `ownerId` on `ScopedBinding`, `MatchResult` and a dispatch record's `RecordCandidate`.
  - `RegistryEntry.toolId` is `ownerId`, and `Conflict.toolIds` is `ownerIds`.
  - `<SceneCanvas ambient>` takes `SurfaceContribution[]`, and `useTools`'s `ambient` (and `ToolsApi.ambient`) takes `Contribution[]`, so a contribution no longer needs casting to `AnyTool`.
  - `findConflicts`, `findScopedConflicts` and `buildRouteRegistry` take `Contribution`s.
  - `defineViewportTool` and `ViewportToolDef` are removed; they were `defineTool` and `ToolDef` under another name.
  - `FallthroughDiagram`'s "Tool" column is "Owner".
  
  These are breaking renames for any consumer reading those fields or calling the removed function.
- 32bb3be: New `DispatchRecord`: for one input, every binding that matched, what the claim and eligibility filters dropped, the ranked survivors with the step that placed each one below the last (`view`, `tier`, `specificity`, `context`, `order`), and what the walk did with each. `Dispatcher.explain` returns one without invoking anything. In dev builds the trace buffer on `window.__weaselDispatchLog__` now holds these records. They replace `DispatchLogEntry`, which is removed, so a reader of that buffer must move to the new shape. `handleInput`, `resolveAll` and `resolveOnly` now share one walk, so a prediction ranks candidates exactly as a dispatch does. `matchSortedWithBarred` reports the bindings an exclusive claim kept out. The types are also exported from `@weasel-js/core/routing`.
  
  New `FallthroughDiagram` in `@weasel-js/ui` draws one record: the input, the matched set, one band per filter, and the ranked list with its walk, with the winner marked.
- 9647b3c: `routeToSpec` turns a parsed route into the `GestureSpec` it describes, so a route string can drive `matchSpec` directly. It throws on a route no spec can express: `keyUp`, a key or finger-count wildcard, or a target that is not a target form.
  
  `specificity` now lives in `@weasel-js/gestures` beside the matcher. `@weasel-js/routing` and `@weasel-js/core` still re-export it.
  
  `describeRoute` reads two or more required modifiers as a held chord ("the user holds Mod and Alt and drags anywhere") rather than "the user Mod and Alt-drags anywhere". It also names the modifiers on multi-finger taps, drops and pastes, which it used to leave out; puts the target on wheel routes; and says "long-presses" for `longPress`.
- 0cecdcf: A tool's `hotkey` can be any key. Besides `'space'` and the modifier names, a
  tool may declare an ordinary key such as `hotkey: 'o'` and it engages while
  that key is held, matched case-insensitively as every key spec is and never
  while typing in a text field. A held key now releases even when its keyup
  reports it differently from its keydown — Shift pressed mid-hold makes an `o`
  press come up as `O`, which used to leave the tool stuck on.
  
  Held-key engagement also works in a `<SceneCanvas>` with no `ActionsProvider`
  of the consumer's own. Before, nothing registered `tool.offhand` there and
  Space-for-hand did nothing. The registration is exported as
  `useOffhandAction` for hosts that assemble their tools above their provider.
  
  `Tool.onActivate` now actually fires — it was declared and forwarded by
  `defineTool` but nothing called it. A tool is live while it holds the active
  slot or is held by its `hotkey`: `onActivate` fires as it becomes live in
  either, and `onDeactivate` as it stops being live in both, or when the canvas
  unmounts. `onDeactivate` used to fire only when the active tool changed, never
  when a held tool was released. Both receive `ToolLifecycleCtx` — just
  `{ scratch }`, which is all `onDeactivate` was ever given; the parameter was
  typed as a full `ToolCtx`, so a callback annotated that way no longer
  typechecks and should close over what else it reads.
  
  `ToolPresentation` takes `hide: true` to keep a tool off `ToolPalette` — for a
  tool that is only ever held. It stays registered and selectable by id.
- 722b267: Every canvas now routes its own input. `<SceneCanvas>`, labkit's `<CanvasStack>` and `<Stage>` each mount an `<InputScope>` — an actions registry, dep registry and active tool of their own — under whatever registries are in scope, so two canvases under one provider no longer hand the newest one everyone's gestures. Registries above a canvas read through to the canvas last used: `trigger`, `begin`, `list` and `useActiveToolContext` there answer from the scope that last took a pointerdown or wheel, and keystrokes dispatch only in that scope.
  
  When bindings tie on scope and specificity, an action gated by an `eligible` rule that holds now outranks one with no rule: in path edit Escape exits the edit instead of resetting the tool, and a bare drag no tool binds marquees where selection is on offer and pans where it is not. The route-conflict check follows the same rule. Escape with nothing selected now returns to the default tool, as `tool.resetToDefault` documents; the standard `escape` action used to spend that press clearing an empty selection.
  
  Canvases that should share input join one yoke: `const yoke = useYoke()`, then `yoke={yoke}` on each canvas and `<Yoke value={yoke}>` around a toolbar. A canvas with no yoke keeps its own tool.
  
  Breaking: `ActionsScope`, `ActionsRegistry.setDepRegistry` and labkit's `CameraScopeContext` are removed; `ActionsRegistry` gains `activate()` and `isActive()`, which a hand-built registry must now supply. A registration made inside one canvas is no longer visible from a sibling canvas — a registry above reaches it only through the active scope. A nested `<WeaselProvider>` now hands its children the outer registry itself.
- 52078c5: A keystroke is dispatched once. Every gesture dispatcher listens for keys on
  `window`, and one now skips a keydown that another dispatcher — or anything
  else — has already claimed with `preventDefault`; before, two dispatchers
  binding the same key both ran it. `keyboard: 'first'` makes a dispatcher listen
  in the capture phase, ahead of the rest whatever the mount order. The lab
  header's zoom uses it, so Mod+= over a trial with a camera zooms the trial and
  not also a story's own canvas; over a trial without one, the key passes to the
  story.
- fd178be: A mode's declared shortcuts now reach the dispatcher. `modeShortcuts(registry, handlers)` returns an always-on contribution with one action per `entry` / `exit` / `discard` / `commit` / `cancel` chord, gated on the mode it acts on and riding the hotkey tier, so leaving a mode outranks Escape clearing the selection while a gesture in flight still cancels first. Pass it in `<SceneCanvas ambient>`; a role with no handler binds nothing. `ModeDefinition` gains `discard` (the soft presets declare Meta+Escape), and `ModeRegistry` gains `list()` — a hand-written registry has to add it.
  
  `useTextEdit` / `useSceneTextEdit` take `escape: 'commit'` to keep the text on Escape instead of dropping it.
- ca2f45f: Every click-versus-drag decision in the kit now reads one threshold, `DRAG_THRESHOLD_PX` (4 CSS pixels), through `pastDragThreshold`. Both now live in `@weasel-js/gestures`; `@weasel-js/routing` and `@weasel-js/core` re-export them as before. `useDragHandle` starts a drag at 4px instead of past 5px, labkit's `FloatingPanel` and the hud window's content click at 4px instead of 3px, and `startThresholdDrag`, `useReorderDragList` and `Select` default to the constant rather than their own literal 4.
  
  The move action's `dragThresholdPx` option works again: set as `selectTool.move.dragThresholdPx` on `<SceneCanvas>`, it holds the selection in place until the pointer has travelled that far on screen. It has been ignored since the `useMove` hook was removed. It cannot lower the threshold below the dispatcher's.
- 242e9f7: `routeGestureForSpecKind` and its inverse `specKindForRouteGesture` now live in `@weasel-js/gestures`, read from one table; `routeToSpec` and routing's route registry both use it. `@weasel-js/routing` and `@weasel-js/core/routing` re-export both.
  
  Every routing type with an overlay parameter — `Tool`, `ToolDef`, `ViewportToolDef`, `Contribution`, `ContributionChrome`, `useTools` and `useContributions` with their option and result types — now defaults it to the kernel's overlay type (`KernelOverlay`), as `defineTool` already did. Under core that is `RenderLayer`, so a routing `Tool<S>` fits `<SceneCanvas tools>` without naming the overlay. Functions that read tools without reading overlays (`buildRouteRegistry`, `findConflicts`, `reportRouteConflicts`, the dispatcher's `toolsById`) take any overlay explicitly.
- aad77d3: The route-conflict check no longer reports two bindings whose actions' `eligible` rules can never hold together, so each mode's own Escape exit from `modeShortcuts` stops warning. The new `rulesExclusive(a, b)` is the test it uses: `true` only when no context passes both rules.
  
  `createDepRegistry()` returns the stock dep registry `<DepRegistryProvider>` mounts, from routing's React-free entry and from core, for a dispatcher driven without a provider tree.
  
  `DRAG_THRESHOLD_PX` and `pastDragThreshold(from, to)` expose the distance a press travels before `useGestureDispatcher` treats it as a drag, and the dispatcher reads that same definition.
  
  There is one `defineTool` now. Routing's defaulted its overlay type to `unknown`, so its tools failed core's `tools` prop; routing now defaults it to `KernelOverlay`, which a kernel sets by merging into the new `OverlaySchema` interface, and core merges `RenderLayer` there and re-exports routing's `defineTool` and `defineViewportTool` instead of wrapping them.
- 94cf4cd: **Breaking.** A bare `<SceneCanvas>` now only renders. It keeps a selection that
  no input sets and runs the gesture dispatcher for bindings you add, but it no
  longer picks, moves, transforms or edits, draws no selection chrome, pans and
  zooms nothing, and binds no keys. `features={['draw']}` restores everything it
  used to do, and adds the hand tool (H, or hold Space), which it used to register
  only when `viewport` was passed.
  
  `features` takes presets that compose in any combination: `view` (wheel pan and
  zoom, pinch, zoom keys, the hand tool — passing `viewport` implies it), `pick`
  (the select tool and the selection outline), `move` (drag to move, Alt-drag to
  clone), `transform` (resize and rotation handles), `edit` (undo/redo, delete,
  duplicate, group, nudge, select-all, Escape, clipboard, fill and stroke, with
  their keys), `arrange` (align, distribute, reorder, flip), `paths` (pathfinder
  and anchor editing), `ingest` (dropped and pasted content), and `draw` for all
  of them. `FEATURE_ACTION_IDS` lists which kit action each one registers. A tool
  brings the actions it binds, so `defaultTools={['rect']}` registers `insert`
  under any preset; `defaultTools` now defaults to none.
  
  `toolBundle` and `BUNDLE_TOOLS` are removed. `toolBundle="minimal"` is
  `features={['draw']}`; `"standard"` adds `defaultTools={['rect', 'ellipse',
  'line']}`, and `"exhaustive"` adds `defaultTools={BUILTIN_TOOL_IDS}`.
  
  The select tool only chooses now: pick, marquee, clear. Moving, cloning,
  resizing and rotating the selection are always-live bindings of their own,
  `selectionMoveContribution` and `selectionTransformContribution`, so they work
  under any tool that leaves the drag unclaimed. `useSelectTool` no longer takes
  `move` or `reparentOnDrop`; pass them to `selectionMoveContribution`, or give
  `<SceneCanvas>` a `selectTool.move`. A host mounting `useSelectTool` on its own
  dispatcher has to add those entries itself to keep drag-to-move.
  
  `rotate` and `clone` no longer carry a bare-drag default binding, which made
  any drag no tool claimed rotate a non-empty selection.
  
  A canvas can run with no active tool: `useTools` takes `active` as optional or
  `null`, and `ToolsApi.active` and `ActiveToolContext.active` can be `null`.
  `ActiveToolContextProvider` starts empty rather than at `'select'`, and the
  first `useTools` call seeds it unless the provider was given `initialActive`.
- 38f524c: `<SceneCanvas>` takes the app's mode registry as `modes` in place of `getActiveMode`. This is a breaking change: replace `getActiveMode={getActiveModeFor(registry)}` with `modes={registry}`. The canvas now repaints when the mode switches, and the dev-time route-conflict check reads the app's own modes instead of the kit's `DEFAULT_MODES`, so a clash that only an app-defined mode allows is reported. `useTools` and `useContributions` take the same `modes` option for a consumer assembling its own tools.
- dbc3c3e: A tool redefined under an id that is already registered now replaces the old definition. `useTools` used to rebuild its `ToolsApi` only when the set of tool ids changed, so a new tool object under the same id — a `cursor` whose size changed, say, passed to `<SceneCanvas tools>` — kept the first definition, and the canvas went on showing the old cursor. The `ToolsApi` now changes whenever any tool in `registry` or `ambient` is a different object, and stays the same while every tool is the same object, even when the record holding them is rebuilt each render.
  
  Tools passed to `<SceneCanvas tools>` should therefore keep their identity between renders, as the kit's own tool hooks do: a tool rebuilt every render now rebuilds the `ToolsApi` every render, which loops a canvas whose `onToolsCreated` sets state.
- f8f6041: A binding with no `phase` now prints as `[*:*]` rather than `[*]` in `routesForSpec`, conflict messages and the dispatch record. `[*]` is shorthand for `[&:*]`, which an ambient binding never matches and which ranks higher on phase, so a route copied out of the inspector used to describe a different binding from the one it was printed from. `routeToSpec` now reads `[*:*]` as "no phase" and keeps `[*]` as the `&:*` atom it abbreviates; a route string that relied on `[*]` meaning "no phase" should say `[*:*]`.
- Updated dependencies [6819653]
- Updated dependencies [9647b3c]
- Updated dependencies [7c3cc5d]
- Updated dependencies [fd178be]
- Updated dependencies [5201b8e]
- Updated dependencies [ca2f45f]
- Updated dependencies [242e9f7]
- Updated dependencies [a028cc3]
- Updated dependencies [38f524c]
- Updated dependencies [f8f6041]
  - @weasel-js/modes@1.7.0
  - @weasel-js/gestures@1.7.0
  - @weasel-js/history@1.7.0
  - @weasel-js/cursor@1.7.0

## 1.6.1

### Patch Changes

- b209a8e: A feature installs from one entry. `SurfaceContribution` extends `Contribution` with `views` and `attach(api, deps)`, and `Contribution` gains `deps`; `<SceneCanvas ambient>` installs every role an entry declares and removes them with it. `mergeContributions` throws on a duplicate dep name or view id as well as a duplicate entry id.
  
  Bindings can be scoped to views with `opts.views`; a binding that names the view an input landed in outranks bindings that do not. `InvocationCtx.viewId` and `RuleCtx.viewId` carry that view, layer `data.viewId` names the view a draw is for, and the `rootView` dep answers the surface camera from inside a view.
  
  `createMinimapContribution` puts a minimap inside a canvas, with a linked crosshair, and `createLinkedCursorContribution` draws the crosshair alone. `<MinimapCanvas>` now runs on a dispatcher, publishes its pointer, and takes an `id`.
  
  Breaking: `PointerContextValue` is a store — `get`, `set`, `subscribe`, `getVersion` — in place of `pointerRef`, and `PointerWorldPos` carries `viewId`. `usePointerPosition()` follows it. `useHud`'s ref is optional; `useHudContribution(hud, options)` attaches the HUD as well as routing its input.
- @weasel-js/cursor@1.6.1
  - @weasel-js/gestures@1.6.1
  - @weasel-js/history@1.6.1
  - @weasel-js/modes@1.6.1

## 1.6.0

### Patch Changes

- 16c0da2: Kit actions can now fill a whole editor toolbar from the registry.
  
  - `Action.variants` lists the separate things a parametric action does, each with its own label and params. `flip` declares Flip Horizontal and Flip Vertical; `reorder.forward` and `reorder.backward` declare their one-step and all-the-way forms. `actionItems(action)` expands an action into the entries a bar, menu or palette shows: one per variant, or the action itself. An action without an immediate invoker gets none, because `trigger` cannot start a drag.
  - `actionShortcuts(action, params)` returns only the shortcuts whose binding passes those params, so each variant shows its own key.
  - `ActionBar` renders one button per entry and triggers it with that entry's params. `icons` and `labels` are now keyed by entry key (`flip:y`, `reorder.forward:extreme`), which is still the action id for an action without variants. `enabled` is evaluated with the deps the action declares in `requires`, not a fixed set of six, and a tooltip without a `shortcut` override now shows the binding's key.
  - New groups: `history` (undo, redo), `clipboard` (cut, copy, paste), `edit` (duplicate, delete), `structure` (group, ungroup) and `flip`.
  - New `clipboard.paste` action, which calls the `clipboard` dep's `paste()`. It has no key binding, because Cmd/Ctrl+V already arrives as a paste event.
  - `enabled` now follows the current state: undo and redo follow the history stacks, `delete` and `group` need a selection, `ungroup` needs a selected container, and `clipboard.paste` needs a non-empty clipboard. `delete`, `group` and `ungroup` used to report enabled unconditionally.
  - Align actions now register left, center, right, top, middle, bottom.
  - `buildDepsFromRequires` is re-exported from `@weasel-js/core`.
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
- 62d8d7c: `useOngoingAction(actionId)` lets a UI control — a color picker, a slider, a swatch — drive an ongoing action the way a drag does: `input(params)` opens the action on the first call and moves it on the rest (the live preview), `commit(params?)` ends it as one undo entry, and `cancel()` drops it. A commit with nothing open is a whole edit on its own, which is what a click on a swatch is. An edit still open when the control unmounts or its action id changes is committed. It wraps `ActionsRegistry.begin`, whose begin-or-update-then-end bookkeeping every such control used to hand-roll around a ref; `SceneGradientHandles` now uses it.
- Updated dependencies [c7e9e4c]
- Updated dependencies [97561f1]
  - @weasel-js/modes@1.6.0
  - @weasel-js/gestures@1.6.0
  - @weasel-js/cursor@1.6.0
  - @weasel-js/history@1.6.0

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
- Updated dependencies [24a2dae]
  - @weasel-js/gestures@1.5.2
  - @weasel-js/history@1.5.2
  - @weasel-js/cursor@1.5.2
  - @weasel-js/modes@1.5.2

## 1.5.1

### Patch Changes

- 4f9fd3b: labkit's loupe routes its peek key and its wheel through the gesture dispatcher, as the `loupe.peek` and `loupe.magnify` actions, instead of attaching `keydown`/`keyup`/`blur` on the window and a capture-phase `wheel` on the host. Taking the wheel from a lab's pan/zoom is now the dispatcher's ordinary rule — `loupe.magnify`'s `enabled` declines while the lens is down, so the event goes unhandled and falls through, and while the lens is up the dispatcher stops propagation before React's root listener runs. Aiming the lens stays a plain `pointermove` listener: the gesture grammar names no hover.
  
  `useGestureDispatcher` takes `channels`, switching off any of the four listener groups it attaches to its element — `pointer`, `wheel`, `contextMenu`, `ingest`. Every one defaults on, so nothing changes for a caller that omits it. A mount that wants one gesture should not also have to take the rest of the pipeline's side effects: `contextMenu` suppresses the native menu unconditionally, and `ingest` makes the element a file-drop target. The loupe mounts with three of the four off, which is what keeps right-click and drops working on a lab that turns a magnifier on.
  
  `<LoupeGestures>`, `createLoupeActions` and `LoupeInputApi` are new on `@weasel-js/labkit/loupe`; `useLoupe`'s returned state carries a new `input` member that `<LoupeGestures>` drives the lens through.
- ed05c54: Withhold the eager `stage: 'press'` dispatch from a pointer that lands while
  another is already down. `pointerDown`-spec bindings fired for a pinch's second
  finger, so starting a two-finger gesture could run `select.pick` and change the
  selection under it. The multi-pointer policy already cleared that pointer's
  buffered drag press for the same reason; the eager copy was left unconditional.
- 2a63f31: Alt+clicking a segment of the path being edited now inserts an anchor where you clicked, and the pen cursor shows while Alt is held over a segment. A straight segment stays straight; a curve is split without changing its shape. The closing edge of a closed path can be split too, the new anchor becomes the selected one, and the click has to land within 8 screen pixels of the path — so the reach no longer changes with zoom. Before this, the split only worked on curves: a straight edge came back as a curve, and the closing edge could not be split at all.
  
  Every anchor edit (drag, nudge, delete, cut, insert) can now be undone. Before, `SceneCanvas` recorded these edits as operations with no inverse, and undoing one threw an error.
  
  Additive: `Action.enabled` gets a second, optional argument — the world point of the click or press being routed. When it returns disabled for that point, the dispatcher tries the next binding, and the hover cursor is not shown there. The hover cursor now also comes from the action a click would run, when the action a drag would run has no cursor. `nearestSegmentT` gets an optional `closed` argument and returns an exact parameter instead of the nearest of 32 samples. `segmentAt` is new. The `SceneCanvas` adapter gains `setData`.
- a7519a1: Remove the `pointer` dep. **Breaking:** `DepSchema` no longer has a `pointer`
  entry, `useStandardActions` no longer takes a `pointer` option, and the fixed
  deps bag handed to an action that declares no `requires` no longer carries it.
  
  Nothing in the kit declared or read it, and `<SceneCanvas>` never supplied a
  value, so an action reading `deps.pointer` was already getting `undefined`. An
  action that wants the pointer reads it from its invocation context
  (`ctx.world`), and code outside an action can still use `usePointerContext()`,
  which is unchanged.
- d963d14: `EligibilityState.heldTriggers` is gone. Nothing populated it: a declared
  `Eligibility.offhand` already reaches the hotkey tier by id, because the
  `tool.offhand` action the declaration registers pushes the tool's id onto the
  active-tool context's hotkey stack, and `engagedIds` is what `liveScope`
  reads. Populating the set instead would have given the same tier a second
  source of truth — raw key state tracked beside the gesture that already owns
  the hold — with release order to reconcile between them.
  
  `offhand` is untouched. Construct `EligibilityState` without the field; a
  consumer reading it has to read `engagedIds` instead.
- Updated dependencies [b6a5eed]
- Updated dependencies [229a16a]
  - @weasel-js/cursor@1.5.1
  - @weasel-js/history@1.5.1
  - @weasel-js/gestures@1.5.1
  - @weasel-js/modes@1.5.1

## 1.5.0

### Patch Changes

- b65f4df: `RuleCtx` carries a zoom, not a `View`.
  
  `zoomAtLeast` is the only selector that ever read the viewport, and one number
  is all it needs. A host whose viewport is a camera had no `View` to hand over,
  so it could not build a rule context at all — and a dispatcher with no
  `getRuleCtx` skips every eligibility rule silently rather than failing.
  
  `RuleCtx.view: View` is now `RuleCtx.zoom?: number`, `BuildRuleCtxArgs` the
  same, and `zoomAtLeast` declines when no zoom is reported. `viewZoom(view)` is
  exported from `@weasel-js/core` for the 2D callers that now pass it; the legacy
  `ChromeCtx` shape still carries a `View` and `resolveVisibility` converts.
- 65806bc: Fix eleven latent routing faults surfaced by the extraction's correctness pass.
  All predate the move into `@weasel-js/routing`.
  
  - Dispatcher and dep-registry ownership are stacks rather than single slots, so
    with two canvases under one `<ActionsProvider>` the one still on screen keeps
    its wiring when the other unmounts. `begin()` no longer returns `null`
    permanently after that.
  - An offhand hotkey hold now releases its own tool instead of whatever is on
    top of the hold stack, so overlapping holds released out of order disengage
    the right tool.
  - `reportDeadClaim` no longer reads `process.env` bare. A consumer loading the
    published ESM in a runtime with no `process` got a `ReferenceError` out of the
    pointerdown listener on any unmatched exclusive claim.
  - `ctx.drag.points` accumulates every pointermove vertex for actions that
    declare no `onMove`. Such an action previously saw only the press point,
    committing a one-vertex path.
  - `ContributionsApi.entries` tracks the entry list rather than the entry list as
    it stood when the focused tool last changed.
  - The dev-only route-conflict reporter compares ambient entries against each
    other (it never did), keeps two collisions on different predicates apart, and
    checks a lone action against itself.
  - `inFlightCursor` reports the most recently started gesture's cursor, agreeing
    with `getActiveAction`; the dispatcher breaks same-specificity hotkey ties in
    favor of the newest hold, agreeing with `ToolsApi.hotkeyEngaged`.
  - **`Eligibility.capabilities` now gates.** It never did: `liveScope`
    short-circuits when no `allows` predicate is supplied, and none was. A tool
    declaring `capabilities` whose action carries no `eligible` rule kept routing
    input in a mode that forbids those tags. The dispatcher builds the predicate
    from the `RuleCtx` it already holds — so this changes behavior only for
    consumers that wired the modes system, which is where the declaration was
    meant to take effect.
  - A multitouch handle is ended when the finger count changes rather than left in
    flight, so a third finger landing mid-pinch no longer commits two gestures on
    the final lift.
  - The route-conflict reporter buckets each key alternative separately, so
    `key: ['h','H']` is reported as colliding with `key: 'H'`. `RegistryEntry`
    gains an optional `argAlternatives` carrying them.
- a614be4: Extract binding-to-action routing into `@weasel-js/routing`.
  
  The gesture dispatcher, the action registry and invoker, tool and contribution
  declaration, the route grammar's reflection surface, and the eligibility rule
  algebra now live in their own package beside `@weasel-js/gestures` and
  `@weasel-js/history`. It ships two entry points: the pure dispatcher on the main
  entry — no React, no DOM — and the React seam that pumps browser events into it
  behind `@weasel-js/routing/react`, with React an optional peer. A kernel that
  drives routing itself can take the first without the second.
  
  `@weasel-js/core` depends on the new package and re-exports every symbol that
  moved, so **no existing import changes**, including `@weasel-js/core/routing`.
  A consumer that adds its own dependency still writes
  `declare module '@weasel-js/core'`; the merge carries through core's re-export.
  
  `createPaintedCursorState` and its types move to `@weasel-js/cursor`, where the
  cursor they hold is declared. `@weasel-js/core` re-exports them unchanged.
- Updated dependencies [a614be4]
- Updated dependencies [ef60ff6]
  - @weasel-js/cursor@1.5.0
  - @weasel-js/gestures@1.5.0
  - @weasel-js/history@1.5.0
  - @weasel-js/modes@1.5.0
