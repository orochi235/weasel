# @weasel-js/routing

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
