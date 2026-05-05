# Gesture / Action / Feedback / Interaction taxonomy

Status: exploratory. No code changes proposed yet — this doc is a yes/no/wait
decision aid for renaming or restructuring `src/interactions/`.

## Framing

The earlier draft of this doc proposed a two-term split — gesture (input)
and action (effect) — composed into an interaction. That misses the third
real concern: the live preview that fills the gap between the gesture
starting and the action committing. Promoting it to a peer term:

- **Gesture** — the input pattern. Drag, click, double-click, alt-drag,
  key chord, hover. Pure input recognizer; no model writes, no rendering.
  Translates raw pointer/keyboard events into a normalized intent stream
  (`start/move/end/cancel`, modifier state, world coords).
- **Action** — the model effect. `translatePose`, `deleteIds`,
  `insertObject`, `setText`, `reorderChildren`. Pure committer; takes
  resolved arguments, emits ops, dispatches via `applyBatch`. No input
  awareness, no rendering.
- **Feedback** — the live preview/affordance rendered between gesture
  start and action commit. Ghost poses, snap indicators, hover
  highlights, marquee rectangles, edit-mode overlays, cursors, rotation
  angle readouts. Pure rendering; no input recognition, no model writes.
  Reads from gesture state (where the pointer is) and from the
  hypothetical-but-not-yet-committed pose the action would emit.
- **Interaction** — the binding of all three. This is what
  Canvas/SceneCanvas consumers actually wire.

**Equation: gesture + action + feedback = interaction.**

Today `src/interactions/` splits into `gestures/` (drag-driven) and
`actions/` (keyboard/imperative-driven). Feedback has no folder of its
own; ghost rendering lives inside the gesture module by convention,
even though it's technically separate (it goes through `Tool.overlay`,
`RenderLayer`, `setOverlay`/`clearOverlay` channels that already
distinguish it). The drift is on the `gestures/` side, where each
"gesture" module bundles all three concerns.

## Motivation

Three reuse axes argue for the four-layer model:

1. **Same gesture, different actions.** Drag-with-preview-then-commit
   shows up in `useMove` (translate), `useClone` (insert copies +
   translate), `useResize` (transform with corner-derived deltas), and
   `useEditAnchors` (mutate one coord pair). All four implement the
   same pointer state machine — pending → active threshold → live
   overlay → commit/cancel — from scratch.

2. **Same action, different gestures.** `Translate` fires from
   `useMove` (drag), `useNudge` (arrow keys), `useClone` (alt-drag,
   after the insert), and could fire from a numeric input panel —
   four entrypoints to one effect. `Delete` fires from
   Delete/Backspace today, but a menu item, a swipe gesture, or a
   right-click context action would all dispatch the identical op
   sequence.

3. **Same feedback across different interactions.** A "snap target"
   highlight is rendered identically whether the user is moving,
   resizing, or clone-dragging. A drag-ghost (translucent preview of
   committed pose + delta) is the same visual whether the underlying
   action is translate or insert-and-translate. A modal-mode overlay
   (e.g. anchor circles while editing) is independent of which
   gesture started the mode. Today every gesture module re-implements
   its own ghost/snap-indicator rendering.

Mixing the layers works fine for one consumer per triple. It becomes
visible cost when (a) a third drag-with-translate gesture appears and
duplicates the state machine, (b) we want to expose a translate
action to a non-gesture caller without reimplementing op
construction, or (c) two interactions want identical feedback
chrome.

## Audit of current modules

Each module scored on three axes — what it owns inside its file body:

| Module | Gesture | Action | Feedback | Bucket |
|---|---|---|---|---|
| `gestures/move/move.ts` | drag state machine, threshold, modifiers | translate-op build + dispatch + layout-pass commit | overlay pose stream, hypothetical layout reflow | mixed, deeply (617 lines) |
| `gestures/clone/clone.ts` | drag state machine + snapshot capture | delegates to `CloneBehavior.onEnd` | overlay item stream | mixed, lightly (137 lines) |
| `gestures/resize/resize.ts` | corner-handle drag | transform-op build + dispatch | overlay pose stream | mixed (419 lines) |
| `gestures/rotate/rotate.ts` | rotation-handle drag | transform-op build | overlay pose stream | mixed (331 lines) |
| `gestures/edit-anchors/editAnchors.ts` | anchor/control drag | one-coord transform-op | overlay pose + selectedAnchors stream | mixed but small (244 lines) |
| `gestures/area-select/areaSelect.ts` | drag-rectangle | replace/add selection | marquee rect stream | mixed (191 lines) |
| `gestures/insert/insert.ts` | drag-rectangle (or click) | adapter `commitInsert` | marquee rect stream | mixed (234 lines) |
| `actions/delete/delete.ts` | (optional keybinding wrapper) | delete-op build + dispatch | none | clean action (74 lines) |
| `actions/nudge/nudge.ts` | (arrow-key wrapper) | translate-op build + dispatch | none | clean action (101 lines) |
| `actions/duplicate/duplicate.ts` | none | duplicate-op build | none | clean action (77 lines) |
| `actions/clipboard/clipboard.ts` | none | clipboard ops | none | clean action (87 lines) |
| `actions/escape, select-all, undo-redo, reorder, group` | none | pure committers | none | clean actions |

Notable findings:

- The `actions/` folder is already a clean action layer (column G
  empty, column F empty).
- Every `gestures/` module is mixed across all three columns. None
  is currently "pure gesture."
- Feedback is the most-duplicated of the three: every drag-style
  gesture re-implements its own overlay-publish stream, and the
  shared shape (`{ live pose, hypothetical pose, drag delta }`) isn't
  factored anywhere. This is the cheapest wedge into a split.

## Behaviors straddle all three layers

`MoveBehavior`, `CloneBehavior`, `ResizeBehavior` were the hardest
unresolved question in the two-term draft. Adding feedback as a peer
term sharpens the question rather than resolving it — behaviors can
genuinely belong to any of the three layers, and some belong to
multiple:

| Behavior | Gesture role? | Action role? | Feedback role? |
|---|---|---|---|
| `snapToGrid` | ✓ filters pointer position before publish | — | (often wants its own snap-line viz) |
| `momentum` | ✓ extends gesture beyond pointer release | ✓ post-commit translate ops | ✓ render the inertial trajectory |
| `snapBack` | — | ✓ rejects commit, restores origin pose | — |
| `reparent` | — | ✓ rewrites ops to retarget parent | ✓ highlight the would-be-new-parent container |
| `cloneByAltDrag` | ✓ activates only with alt | ✓ dispatches insert+translate | — |

A clean three-layer split would force each behavior to pick a layer
or to register hooks at multiple layers. The current single-layer
behavior API (one object, full `GestureContext`) lets one behavior
do all three at once. Whether that's a feature or a tangle depends
on how often we actually compose behaviors across layers.

This is the **principal blocker** for the rename. Until we have a
behavior taxonomy, we don't know where to put the layer seams.

## Proposed structure

Two flavors. **Option A** keeps the current top-level split but
introduces sub-layers without breaking exports:

```
src/interactions/
  gestures/
    primitives/         # NEW: pure input recognizers, no model writes
      useDragGesture.ts # threshold + start/move/end/cancel + modifiers
      useHandleDrag.ts  # drag from a hit-tested handle (resize/rotate/anchor)
      useMarquee.ts     # drag-rectangle (shared by area-select + insert)
      useChord.ts       # key + drag combo
    move/               # composed interaction = primitive + action + feedback
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
  feedback/             # NEW: shared rendering primitives
    dragGhost.ts        # translucent ghost layer factory (already exists at features/drag/dragGhost — possibly relocate)
    marqueeRect.ts      # selection-rectangle layer factory
    snapIndicator.ts    # snap-target highlight layer factory
    handleAffordance.ts # corner/edge handle visuals (already in selection-overlay)
```

The composed interaction modules (move, resize, etc.) keep their
current public hooks, but their bodies become thin: wire a primitive
gesture to a primitive action plus the feedback layers. The `Tool`
overlay channel is the natural seam for feedback exports — tools
already publish overlays through that channel; making the
underlying interactions do the same factors out the duplication.

**Option B** is the literal four-folder rename:

```
src/interactions/
  gestures/      # pure recognizers
  actions/       # pure committers
  feedback/      # pure rendering
  bindings/      # composed interactions (current gestures/move, gestures/resize, ...)
```

Option B is cleaner taxonomically but less honest about what the
existing public hooks are: `useMove`, `useResize`, etc. are bindings
in this terminology, and renaming the folder they live in to
`bindings/` reads strangely from the consumer side. Option A keeps
the consumer-facing surface stable while letting the primitives
emerge.

## Costs and open questions

- **Three seams instead of one.** `useMove` becomes `useDragGesture`
  + `translatePose` action + a feedback composer. Three units to
  understand instead of one. Worth it only if each unit is reused
  by another consumer; otherwise it's pure overhead. Today
  `translatePose` would have three callers (move, clone, nudge);
  `dragGhost` already has ~four (move, resize, rotate, clone) but
  via `features/drag/dragGhost` rather than a named feedback module.
  Real but modest payoff.

- **Where do behaviors live?** (See the table above.) This is the
  principal unresolved question. A behavior may need to register
  hooks at gesture, action, and feedback layers simultaneously,
  which means the current "one object with the full context" API
  is actually the right shape for behaviors, even if the underlying
  interaction is split. The split would change behavior internals
  (each hook reads its layer's context, not the global one) but
  not the consumer-facing behavior shape.

- **Redundancy with the Tool layer.** `useSelectTool`,
  `useInsertTool`, etc. already compose multiple interactions
  (move + area-select + edit-anchors-on-double-click + …) and route
  pointer events among them. If the gesture/action/feedback split
  inside `interactions/` surfaces the same primitives the Tool
  layer is composing, are we splitting at the wrong level?
  Plausible alternative: leave `interactions/` as-is and push
  action+feedback extraction up to peer top-level dirs
  (`src/actions/`, `src/feedback/`) consumed by both interactions
  and tools.

- **Migration cost.** Every demo, every test, and the Canvas
  pointer router import `useMove`, `useResize`, `useClone`, etc.
  directly. A hard rename is a wide blast radius for marginal
  payoff. An additive split (introduce `useDragGesture` +
  `translatePoseAction` + `useDragGhostLayer` alongside `useMove`,
  leave `useMove` as a thin convenience re-export) is safer and
  reversible.

## Recommendation: wait

Do not reorganize yet. The current `gestures/` vs `actions/` split
is already pulling its weight on the action side, and the
mixing-of-concerns pain on the gesture side is real but not yet
biting:

- Only **two** consumers want a translate action without inheriting
  the move gesture's full state machine: `useNudge` (already in
  `actions/` and reimplements translate-op-building inline) and
  `useClone` (delegates to behavior). Two callers is not enough to
  motivate extracting `translatePose` as a shared primitive.
- Feedback duplication is broadest (four+ callers re-implement
  drag-ghost rendering), but `features/drag/dragGhost` already
  partially addresses it. The remaining duplication is in the
  *plumbing* (publishing the overlay through `setOverlay`
  callbacks) more than in the visuals.
- The behavior-layer question is unresolved. Splitting before we
  know how behaviors compose across the three layers risks landing
  seams in the wrong place and re-cutting later. The behaviors
  table above shows that several real behaviors (`momentum`,
  `cloneByAltDrag`) live in two layers simultaneously — splitting
  before we have an API for that case will create churn.
- A third drag-with-translate consumer (touch-drag, formula-driven
  align, programmatic layout commit) is the trigger that would
  unblock this. Until then duplication is contained to four files
  (`move`, `clone`, `resize`, `rotate`), each of which already
  extracts geometry/behavior helpers.

What would unblock yes:

1. A third gesture wanting to commit a translate action with
   different input (touch drag, formula bar, programmatic align).
2. A behavior taxonomy clean enough that each behavior fits one
   layer (or has clear sub-hooks per layer it touches). The current
   table shows multi-layer behaviors are common, which argues
   *against* a hard layer split.
3. A consumer outside `interactions/` (Tool layer, plugin,
   accessibility helper) wanting to invoke `translatePose` as a
   pure action, or `dragGhost` as a pure feedback layer, without
   pulling in the gesture.

What would unblock no (close the question):

1. Demonstrating that the Tool layer is the correct place for
   gesture/action/feedback composition, and pushing extraction up
   to peer `src/actions/` and `src/feedback/` directories consumed
   by both.

## Adjacent cleanup worth doing now (no taxonomy change)

- Extract `dispatchTranslateOps(adapter, ids, dx, dy, label)` as a
  shared helper used by `useMove`, `useNudge`, `useClone`'s default
  behavior, and any future caller. Pure refactor, no API change,
  removes the most visible duplication and de-risks a future
  split.
- Move the layout-pass logic in `useMove` (lines ~285–500) into
  `gestures/move/layoutPass.ts`. It's already a discrete concern
  buried in a long file; extracting it makes the eventual
  gesture/action seam easier to see.
- Audit overlay-publishing plumbing across move/resize/rotate/clone
  for a shared `useOverlayChannel(setOverlay, clearOverlay)` shape.
  The four hooks all do the same thing: mirror a stream of
  hypothetical poses to the consumer's overlay state. A 30-line
  helper would collapse the duplication without touching any of
  the larger questions.

These three are independently worth doing and don't commit to the
larger reorg.
