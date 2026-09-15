# @weasel-js/routing

## 1.5.1

### Patch Changes

- @weasel-js/cursor@1.5.1
  - @weasel-js/gestures@1.5.1
  - @weasel-js/history@1.5.1
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
