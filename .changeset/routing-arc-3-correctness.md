---
"@weasel-js/routing": patch
"@weasel-js/core": patch
---

Fix eight latent routing faults surfaced by the extraction's correctness pass.
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
