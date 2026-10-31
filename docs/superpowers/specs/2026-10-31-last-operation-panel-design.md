# Last-operation panel

For whoever builds or extends how a command's parameters reach the user. Answers: where a niche command's
parameters live, given that a permanent bar slot per parameter does not scale.

Status: chosen by the maintainer (2026-10-31) over a menu-only or inspector home; built on branch `last-op-panel`
(2026-10-31).

## Behavior

Run a command that has parameters (Bridge, Resample, Add extremes, …) and a small panel appears in a corner of
the workspace, titled with the command's label and holding its parameters at the values just used. Changing one
re-runs the command in place: the result it produced is replaced, and the whole thing stays one undo entry. The
next action of any other kind, an undo or redo, or the panel's close button dismisses it. The values last used
become that command's values for its next run in the session.

## Kit

- **An action declares its parameters at runtime**: `Action.params?:` a `@weasel-js/prefs` group (labels, ranges,
  steps, defaults). This is what the panel draws; the type-level `ActionParamSchema` stays what `tune` checks.
- **The kit keeps the last adjustable invocation**: an immediate action with `params` that commits a history entry
  is recorded with its params, the history entry it made, and the selection before it ran. Recording clears on
  any other history entry, on undo or redo, and on dismissal. Exposed as a subscribable store with
  `adjust(patch)` and `dismiss()`.
- **A drag is recorded too, when it can be replayed** (2026-10-31): an ongoing action with `params` whose gesture
  handle has `replay(params)` is recorded when its `onEnd('commit')` leaves one entry, the selection taken at the
  press. `adjust` undoes that entry, restores the selection, and calls `replay` with the merged params, which
  recomputes the commit from what the gesture recorded (start state, final pointer or every move, modifiers).
  A gesture that cannot recompute faithfully omits `replay` and gets no panel. The contract is on
  `OngoingHandle.replay`.
- **`params` may be a function** of the params a run resolved, answering its form or `null` (2026-10-31): `insert`
  shows a polygon's sides or a star's points and inner radius, and nothing for other kinds. The panel is titled
  with the form's name.
- **Edits inside a journal** (draw's path edit, by default) are recorded on that journal, through
  `History.activeJournal()` and `Journal.observe` (2026-10-31); the journal committing, cancelling or suspending
  ends the operation.
- **`adjust(patch)`** undoes the recorded entry, restores the recorded selection, re-runs the action with the
  merged params, and records the new entry in its place, so undo history holds one entry.
- **Last-used values**: the merged params become the action's session params, under any app `tune`.
- **`<LastOperationPanel>`** in `@weasel-js/ui`: draws the store's current invocation as a form of its `params`,
  calling `adjust` on change; empty when there is none. Its own story and tests.

## WeaselDraw

- Mounts `<LastOperationPanel>` inside the workspace (`.wd-canvas-host`), bottom-left.
- Drops the Bridge popover and `useBridgeTension` added earlier the same day: Bridge's tension comes from the panel.
- Every path-tools and core action that reads numeric or enum params gets a `params` group: `bridgePaths`,
  `bridgeAnchors`, `resamplePath`, `addExtremeAnchors`, `extendToMeet`, `trimPath`, `cycleCornerShape`, and the
  drags `lengthenPath`, `girth.drag`, `editCorner`, `linkAnchor`, and `insert` (polygon and star). Simplify and
  Offset keep their live sliders; variant-driven actions, live path effects (edited on the selection through
  `editPathEffect`), `setCorners` (the corner controls' action), selection-only commands, and plain manipulation
  drags (move, resize, rotate, anchor edits) get none. Not built yet: the Smudge brush, the Simplify brush, and the
  warps (Distort, Envelope mesh, Puppet warp).
