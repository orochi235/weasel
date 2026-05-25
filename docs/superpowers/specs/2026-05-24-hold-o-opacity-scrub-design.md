---
date: 2026-05-24
status: spike
owner: apps/draw
---

# Hold-O Opacity Scrub

## Goal

Add a hold-to-scrub keybinding in `apps/draw`: while `O` is held and at least
one node is selected, the mouse wheel adjusts the opacity of the selection in
real time. Release commits the change as a single undo entry.

This is a spike. Scope is intentionally narrow; deeper primitives (per-node
opacity multiplier, keybinding customization) are out of scope.

## Behavior

**Activation**
- Global `keydown` listener on `KeyO`.
- Ignored when the focused element is an input / textarea / contenteditable,
  or when any modifier (Ctrl/Cmd/Alt/Meta/Shift) is held at the moment of
  press.
- Activates only if `selection.size >= 1`. Otherwise the key is a no-op.

**While held**
- `wheel` events on the canvas (or workspace) are captured with
  `preventDefault` so the page doesn't scroll.
- `deltaY > 0` decreases opacity; `deltaY < 0` increases it.
- Step: 5% per notch. Holding Shift switches to 1% per notch (fine).
- Apply a multiplicative scale to each selected node's fill-alpha *and*
  stroke-alpha together, preserving their ratio. The scale factor is chosen
  so the larger of the two alphas reaches the target — i.e. clamp by the
  brighter paint so neither clips.

**Release**
- `keyup` on `KeyO` ends the session. HUD fades out.

## Opacity model (spike)

Per-paint alpha is the only opacity in `apps/draw` today: fill and stroke
each carry their own alpha as the last byte of `#rrggbbaa`. A future
node-level opacity multiplier is the "right" answer but is a separate spec.

For this spike, the scrub operates directly on the fill/stroke alpha bytes
via the same `toHex8` / `withAlpha01` helpers `PropertyColorInput` uses.

Nodes whose fill or stroke is not a `#rrggbbaa` string (e.g. gradient,
pattern, or `null` "no paint") are skipped silently.

## Undo coalescing

One undo entry per O-session, not per wheel tick.

- On `keydown` (with selection present), snapshot original `{ fill, stroke }`
  per selected node into a session record.
- On each `wheel` tick, compute the new paints from the snapshot + the
  *accumulated* scrub delta, and write them through the existing
  set-paint op. If the op model supports in-place coalescing (replacing the
  prior session op's payload), use that. If not, the fallback for the spike
  is to apply via a direct adapter write during the session, then on
  `keyup` emit a single op that goes from snapshot → final state.
- The exact mechanism is a research item during implementation; the
  invariant is "one undo entry per press-release".

## HUD

A transient chip showing `Opacity NN%` while O is held. The NN reported is
the *brightest* paint alpha across the selection (rounded), so the user
sees "what's about to clip" rather than an averaged number.

Placement: top-center of the workspace (`.wd-canvas-host`), positioned with
CSS, fades out ~200ms after `keyup`. If a transient-HUD primitive already
exists, reuse it; otherwise a minimal module-scoped component is fine for
the spike.

## Out of scope

- Configurable key (always `O` for the spike).
- Per-paint targeting (fill-only vs stroke-only).
- Node-level opacity multiplier as a new data field.
- Multi-selection with mixed paint types beyond "skip unsupported".
- Keyboard step (no arrow-key fallback while O is held).
- Touch / pen gestures.

## Open questions deferred to implementation

- Exact op coalescing mechanism (see "Undo coalescing" above).
- Whether the wheel listener attaches to the canvas element or the workspace
  host — depends on which already swallows wheel for view navigation.
