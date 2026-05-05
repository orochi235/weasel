# Gesture / Action / Interaction taxonomy

Status: exploratory. No code changes proposed yet — this doc is a yes/no/wait
decision aid for renaming or restructuring `src/interactions/`.

## Framing

Three layers, currently conflated to varying degrees:

- **Gesture** — the input pattern. Drag, click, double-click, alt-drag, key
  chord, hover. Pure input recognizer; no model writes. Translates raw
  pointer/keyboard events into a normalized intent stream
  (`start/move/end/cancel`, modifier state, world coords).
- **Action** — the model effect. `translatePose`, `deleteIds`, `insertObject`,
  `setText`, `reorderChildren`. Pure committer; takes resolved arguments,
  emits ops, dispatches via `applyBatch`. No input awareness.
- **Interaction** — a gesture bound to an action, plus any live
  preview/ghost/feedback rendered between `start` and `end`. This is what
  Canvas/SceneCanvas consumers actually wire.

Today `src/interactions/` is split into `gestures/` (drag-driven) and
`actions/` (keyboard/imperative-driven), but the gesture modules are mostly
**interactions** in the sense above — `useMove` owns input tracking, overlay
state, behavior plumbing, op construction, and dispatch. The split between
the two folders is more "has a pointer drag" vs. "doesn't" than "input
recognizer" vs. "model committer."

## Motivation

Two reuse axes argue for the three-layer split:

1. **Same gesture, different actions.** Drag-with-preview-then-commit shows
   up in `useMove` (translate), `useClone` (insert copies + translate),
   `useResize` (transform with corner-derived deltas), and `useEditAnchors`
   (mutate one coord pair). All four implement the same pointer state
   machine — pending → active threshold → live overlay → commit/cancel —
   from scratch.
2. **Same action, different gestures.** `Delete` fires from
   Delete/Backspace today, but a menu item, a swipe gesture, or a
   right-click context action would all dispatch the identical op
   sequence. `Translate` fires from `useMove` (drag), `useNudge`
   (arrow keys), `useClone` (alt-drag, after the insert), and could fire
   from a numeric input panel — four entrypoints to one effect.

Mixing the layers works fine for one consumer per pair. It becomes
visible cost when (a) a third drag-with-translate gesture appears and
duplicates the state machine, or (b) we want to expose a translate
action to a non-gesture caller (programmatic alignment, formula bar,
keyboard-driven layout) without reimplementing op construction.

## Audit of current modules

Read the index/main file of each. Bucket per module:

### `src/interactions/gestures/`

- **move/move.ts** — *mixed, deeply.* 617 lines. Owns drag state machine,
  threshold gate, behavior dispatch, snap, layout-pass with z-order
  walk and drop-target picking, source-reflow ops, transform op
  construction, and dispatch. The "gesture" parts (pointer state, modifiers,
  pending→active) are roughly 30% of the file; the rest is
  translate-with-layout action logic. Splitting is high-value but
  high-effort.
- **clone/clone.ts** — *mixed, lightly.* 137 lines. Drag state machine
  + snapshot-translate-overlay + delegates op construction to
  `behavior.onEnd`. Already half-split: the gesture loop is generic,
  the action lives in `CloneBehavior`. The clean cut would extract the
  drag-with-snapshot loop to a shared gesture and leave behaviors as
  the action surface.
- **resize/resize.ts** — *mixed.* 419 lines. Corner-handle drag state +
  geometry + behavior plumbing + transform op dispatch. Geometry
  (`geometry.ts`, `cornerHandles.ts`) is already factored out.
  Splittable but the gesture and the action share the corner-derived
  pose math, so the seam is not obvious.
- **rotate/rotate.ts** — *mixed.* 331 lines. Same shape as resize:
  handle drag + angle math + transform op. Geometry is extracted.
- **edit-anchors/editAnchors.ts** — *mixed but small.* 244 lines.
  Anchor hit-test → drag → mutate one coord → transform op. The
  gesture is a special-purpose drag (single anchor); the action is
  "set one coord on a polygon." The seam is clean if we want it, but
  the action has only one caller.
- **area-select/areaSelect.ts** — *mixed, but the action is selection
  not model write.* 191 lines. Drag-rectangle gesture + behavior-
  decided replace/add semantics. The "action" here is selection, which
  is itself a borderline case (selection ops vs. transient state).
- **insert/insert.ts** — *mixed.* 234 lines. Drag-rectangle (or click)
  gesture + adapter-materialized insert op + drag-disabled fallback.
  The drag-rectangle gesture is the same primitive as `area-select`;
  shareable.

### `src/interactions/actions/`

- **delete/delete.ts** — *pure action* (with optional keyboard binding).
  74 lines. `deleteSelection()` constructs ops + dispatches; `useKeybinding`
  is an optional gesture-ish add-on. Already in the right shape.
- **nudge/nudge.ts** — *pure action* (with arrow-key binding).
  101 lines. `nudge(direction, large)` constructs translate ops +
  dispatches. The binding to ArrowKeys is a thin gesture wrapper.
- **duplicate/duplicate.ts** — *pure action.* 77 lines. Imperative
  trigger; no gesture surface.
- **clipboard/clipboard.ts** — *pure action.* 87 lines. Imperative
  cut/copy/paste.
- **escape**, **select-all**, **undo-redo**, **reorder**, **group** —
  pure actions, all keyboard- or imperative-driven.

The `actions/` folder is already a clean action layer. The drift is on
the `gestures/` side, where the "gestures" are really interactions.

## Proposed structure

Two flavors. **Option A** keeps the current top-level split but
introduces a `behaviors/`-style "primitives" sub-layer for shared
gesture machines, without breaking exports:

```
src/interactions/
  gestures/
    primitives/         # NEW: pure input recognizers, no model writes
      useDragGesture.ts # threshold + start/move/end/cancel + modifiers
      useHandleDrag.ts  # drag from a hit-tested handle (resize/rotate/anchor)
      useMarquee.ts     # drag-rectangle (shared by area-select + insert)
      useChord.ts       # key + drag combo
    move/               # composed interaction = primitive + action
    resize/
    rotate/
    clone/
    insert/
    area-select/
    edit-anchors/
  actions/              # unchanged; pure committers
    translatePose.ts    # NEW: extracted from move/clone/nudge
    transformPose.ts    # NEW: extracted from resize/rotate
    insertObject.ts     # NEW: extracted from insert
    setPathCoord.ts     # NEW: extracted from edit-anchors
    delete/ nudge/ duplicate/ clipboard/ ...
```

The composed interaction modules (move, resize, etc.) keep their
current public hooks, but their bodies become thin: wire a primitive
gesture to a primitive action plus the overlay/preview rendering.

**Option B** is the literal three-folder rename:

```
src/interactions/
  gestures/      # pure recognizers (no current files match this strictly)
  actions/       # pure committers (current actions/ + extractions from gestures/)
  bindings/      # composed interactions (current gestures/move, gestures/resize, ...)
```

Option B is cleaner taxonomically but less honest about what the
existing public hooks are: `useMove`, `useResize`, etc. are bindings
in this terminology, and renaming the folder they live in to
`bindings/` reads strangely from the consumer side. Option A keeps
the consumer-facing surface stable while letting the primitives
emerge.

## Costs and open questions

- **Two seams instead of one.** `useMove` becomes `useDragGesture` +
  `translatePose` action + an overlay composer. That's three units to
  understand instead of one. Worth it only if any of the three is
  reused by another consumer; otherwise it's pure overhead. Today
  `translatePose` would have three callers (move, clone, nudge),
  which is a real but modest payoff.
- **Behaviors live where?** `MoveBehavior`, `CloneBehavior`,
  `ResizeBehavior` currently sit inside the gesture and observe the
  full `GestureContext`. Some behaviors are input filters
  (snap-to-grid reads modifiers and pointer position — gesture
  layer). Some are commit-time policies (snap-back rejects the move,
  reparent reroutes ops — action layer). The current single-layer
  design lets one behavior do both; splitting forces the API to pick
  a side or to expose hooks at both layers. This is the hardest open
  question — splitting may regress the behavior composition story.
- **Redundancy with the Tool layer.** `useSelectTool`, `useInsertTool`,
  etc. already compose multiple interactions (move + area-select +
  edit-anchors-on-double-click + ...) and route pointer events
  among them. If the gesture/action split inside `interactions/`
  surfaces the same primitives the Tool layer is composing, are we
  splitting at the wrong level? Plausible alternative: leave
  `interactions/` as today (each module = one "interaction" hook),
  and push action extraction up to a new top-level
  `src/actions/` consumed by both interactions and tools.
- **Migration cost.** Every demo, every test, and the Canvas pointer
  router import `useMove`, `useResize`, `useClone`, etc. directly.
  A hard rename is a wide blast radius for marginal payoff. An
  additive split (introduce `useDragGesture` + `translatePoseAction`
  alongside `useMove`, leave `useMove` as a thin convenience
  re-export) is safer and reversible.

## Recommendation: wait

Do not reorganize yet. The current `gestures/` vs `actions/` split is
already pulling its weight on the action side, and the
mixing-of-concerns pain on the gesture side is real but not yet
biting:

- Only **two** consumers want a translate action without inheriting
  the move gesture's full state machine: `useNudge` (already lives
  in `actions/` and reimplements translate-op-building inline) and
  `useClone` (delegates to behavior). Two callers is not enough to
  motivate extracting `translatePose` as a shared primitive.
- The behavior-layer question is unresolved. Splitting before we
  know whether snap/momentum/reparent belong to gesture or action
  risks landing the seam in the wrong place and re-cutting later.
- A third drag-with-translate consumer (e.g., a hypothetical
  formula-driven align tool, or a touch-drag handle on mobile) is
  the trigger that would unblock this. Until then the duplication
  is contained to four files (`move`, `clone`, `resize`, `rotate`),
  each of which already extracts geometry/behavior helpers — the
  remaining gesture-loop duplication is shallow.

What would unblock yes:

1. A third gesture wanting to commit a translate action with
   different input (touch drag, formula bar, programmatic align).
2. A behavior that demonstrably belongs to one layer and not the
   other — e.g., snap-back is clearly commit-time-only, snap-to-grid
   is clearly input-filter-only, and the rest fall on one side. Right
   now they straddle.
3. A consumer outside `interactions/` (Tool layer, plugin,
   accessibility helper) wanting to invoke `translatePose` as a pure
   action.

What would unblock no (close the question):

1. Demonstrating that the Tool layer is the correct place for
   gesture/action composition, and pushing action extraction up to a
   peer `src/actions/` directory consumed by both.

## Adjacent cleanup worth doing now (no taxonomy change)

- Extract `dispatchTranslateOps(adapter, ids, dx, dy, label)` as a
  shared helper used by `useMove`, `useNudge`, `useClone`'s default
  behavior, and any future caller. Pure refactor, no API change,
  removes the most visible duplication and de-risks a future split.
- Move the layout-pass logic in `useMove` (lines ~285–500) into
  `gestures/move/layoutPass.ts`. It's already a discrete concern
  buried in a long file; extracting it makes the eventual gesture/
  action seam easier to see.

These two are independently worth doing and don't commit to the
larger reorg.
