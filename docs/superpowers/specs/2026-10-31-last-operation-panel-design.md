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
- **`adjust(patch)`** undoes the recorded entry, restores the recorded selection, re-runs the action with the
  merged params, and records the new entry in its place, so undo history holds one entry.
- **Last-used values**: the merged params become the action's session params, under any app `tune`.
- **`<LastOperationPanel>`** in `@weasel-js/ui`: draws the store's current invocation as a form of its `params`,
  calling `adjust` on change; empty when there is none. Its own story and tests.

## WeaselDraw

- Mounts `<LastOperationPanel>` inside the workspace (`.wd-canvas-host`), bottom-left.
- Drops the Bridge popover and `useBridgeTension` added earlier the same day: Bridge's tension comes from the panel.
- Every path-tools and core action that reads numeric or enum params gets a `params` group, starting with
  `bridgePaths`, `bridgeAnchors`, `resamplePath`, and `addExtremes`; Simplify and Offset keep their live sliders.
