# Path-edit undo granularity

## Problem

Undo inside path-edit mode is unusable. A single anchor drag produces dozens of undo entries (one per `pointermove` tick), and the existing in-tool `commitEditAsOp` always stamps `from = state-at-edit-mode-entry`, so even when entries don't multiply they overlap incorrectly with each other.

Two compounding causes in `src/tools/builtin/pen/usePenTool.ts`:

1. The drag handlers (anchor drag at L725, handle drag at L785) and one-shot edit actions (segment-click insert L699, scissors L687, nudge L330) all call `ctx.applyOps([op], label)` directly inside `onMove` / on every event. With `apps/draw` constructing history at the default `coalesceWindowMs: 0` (`apps/draw/src/modality/useModality.ts:60`), every call is its own entry.
2. `commitEditAsOp` (`src/tools/builtin/pen/penEdit/scratch.ts:70`) builds `SetPathOp(from = scratch.edit.original, to = current)`. `original` is the path snapshot taken at `enterEditMode`. So each emitted op's `from` is the edit-session start, not the gesture start — meaning even with correct entry-per-gesture granularity, undoing gesture B would also revert gesture A.

The desired policy, stated explicitly: **one click or drag = one undo entry**, with cursor-movement coalescing happening _within_ a drag (not across separate gestures).

## What already enforces the policy elsewhere

Every other drag-driven action follows the same convention:

- `src/interactions/actions/defaults/move.ts` — preview map during drag; `scene.batch('Move', …)` on commit (L338).
- `src/interactions/actions/defaults/rotate.ts` — preview map during drag; `scene.batch('Rotate', …)` on commit (L217). Header comment at L13 calls this out: "one undo entry for the whole drag."
- `resize.ts`, `setFill.ts`, `setStroke.ts`, `setFillOpacity.ts`, `setStrokeOpacity.ts` — same shape.
- `nudge.ts` — `scene.batch('Nudge', …)` per keystroke. One entry per nudge, which already matches the policy.

A sweep of `src/tools/builtin/**` and `src/interactions/actions/**` shows pen edit-mode is the only outlier.

## Solution

Bring pen edit-mode in line with the existing preview-then-commit pattern, scoped per gesture.

### Behavioral target

- Anchor drag: while the pointer is down, mutate scratch + render only. On release, push **one** `SetPathOp` covering the whole drag.
- Handle drag: same.
- Segment-click insert (Add anchor): one entry per click.
- Scissors (alt-click anchor on closed subpath): one entry per click.
- Alt-click insert on an existing path (create-mode entry into edit, L437): unchanged — already one-shot.
- Nudge (arrow keys): one entry per keystroke (matches `nudge.ts`).
- Mode exit (`commitEditAndExit`): no longer commits a "session-wide" op. The modality machine's `commit` (`apps/draw/src/modality/machine.ts:100`) already squashes the path-edit `Journal`'s per-gesture entries into a single parent-history entry via `journal.commit(label)` → `parent.recordEntry(allForwardOps, label)`. Inside edit mode, undo walks per gesture; once committed, the outer stack shows one tidy "Edit path" entry. This is the Illustrator-style behavior we want.

### Implementation

1. **Per-gesture baseline.** Add `scratch.edit.gestureBaseline: { path: PolygonPath | RectPath; closed: boolean; params: unknown } | null`.

   Captured at gesture start:
   - Drag begin (anchor, handle): set `gestureBaseline = preConvert ?? { path: anchorsToPath(...current state...), closed: current, params: undefined }`. Clear `scratch.edit.preConvert` after capture so the parametric trapdoor only contributes once (next gesture's baseline is its own pre-state).
   - One-shot actions: capture inline immediately before mutating.

2. **Drag handlers stop pushing per tick.** In `drag.anchor` and `drag.handle` `onMove`, drop the `commitEditAsOp + applyOps` calls. Keep `dragAnchor` / `dragHandle` (they mutate scratch) and `forceRenderRef.current()`. On `onRelease`, build a single op from `gestureBaseline` → current and push via `applyOps`, then clear `gestureBaseline`.

3. **One-shot actions use a per-call baseline.** `click.segment`, `click.anchor` (scissors branch), and the nudge helper each capture a baseline immediately before their mutation and commit one op with it.

4. **Rework `commitEditAsOp`.** Replace its `from = scratch.edit.original` logic with a small `commitWithBaseline(scratch, baseline, label) → Op | null` helper that takes the baseline as an argument. The "dirty" check stays (no-op gestures don't push). Drop the `coalesceKey: penEdit:${objId}` — irrelevant once we're not pushing per-tick, and we explicitly _don't_ want cross-gesture merging.

5. **Drop `scratch.edit.original`.** It only existed as a session-wide baseline for the old commit-on-exit model. Nothing else reads it after this change.

6. **`commitEditAndExit` becomes a thin wrapper.** Just `exitEditMode(s) + forceRenderRef`. The journal/modality layer handles the squash.

### Out of scope

- Any change to `coalesceWindowMs` or to the history layer's coalescing logic. The history layer already supports the right behavior; the bug was that pen edit-mode wasn't using it correctly.
- Other tools — the sweep found no other per-tick offenders.
- Compound-path / closed-figure edits in create mode (different code path, no edit-mode session).

## Risks

- **Test coverage.** `src/tools/builtin/pen/usePenTool.edit.test.tsx` exists and likely asserts on per-tick op emission. Expect to rewrite assertions to check "one op per gesture" semantics instead. Same for any test that pokes `scratch.edit.original`.
- **Parametric trapdoor first gesture.** First gesture on a rect/parametric path must produce an op whose `from` is the parametric form (so undo restores the rect), not the freshly-derived polygon. This is exactly what the `gestureBaseline = preConvert ?? ...` capture covers, but it deserves a focused test.
- **Mode-exit-while-drag-in-flight.** If a user starts a drag and the mode exits mid-drag (e.g., target deleted externally), we should release without committing a half-baked op. The existing `onCancel` paths already null out `activeHandle` / `marquee`; we add `gestureBaseline = null` to them.
