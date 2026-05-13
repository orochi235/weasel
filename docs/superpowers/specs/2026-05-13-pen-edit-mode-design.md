# Pen Edit Mode — Design

## Problem

Once a path is committed to a `PathObj`, there's no way to get back to its anchor-level representation. The pen tool's rich in-progress model (`PenAnchor` with smooth/corner handles, alt-broken mirroring) collapses into raw cubic-Bezier commands at commit time, and we have no UI to re-enter that model.

Concrete user pain: drew a curve, clicked off, realized one handle is slightly wrong → no recourse short of deleting and redrawing. SVG imports — which arrive as flat `C` commands and may need fixup — are especially painful.

## Goals

Re-enter pen-style anchor editing on any path-shaped obj:

- Originally drawn with the pen tool.
- Drawn with pencil/freehand and smoothed.
- Imported from SVG.
- Drawn with a parametric tool (rect, ellipse, polygon, star) — entering pen-edit on these is **a destructive trapdoor**: the obj loses its parametric nature.

## Non-goals

- Preserving parametric obj-ness through edit ("live shapes"). Out of scope.
- A separate "direct selection" tool / white arrow. Pen tool handles both create and edit.
- Per-anchor or per-handle history granularity. All anchor mutations within a drag coalesce into one undo entry.
- Persisting anchor metadata on the obj — anchors are derived on edit-mode entry, re-derived next time.

## User-facing behavior

### Entering edit mode

Pen tool active + **double-click on a path obj** → enter edit mode for that obj.

- Single click on canvas with pen tool still means "start a new path" (unchanged).
- The double-click target's `tool` (pen, rect, ellipse, polygon, star, pencil, imported) does not affect whether edit mode opens — all of them are editable.

### Exiting edit mode

Any of the following commits the current anchor state and exits:

- Escape.
- Enter / Return.
- Click on empty canvas (the canvas region outside the edited obj's path).
- Switching to any other tool.

Selection is preserved on the (now just-a-path) obj after exit.

### Operations available in edit mode

| Gesture | Result |
|---|---|
| Pointer down on anchor + drag | Move that anchor (handles travel with it) |
| Pointer down on handle endpoint + drag | Move that handle |
| Alt + drag on handle endpoint | Break smoothness — opposite handle stays put (smooth → corner) |
| Click on segment (between two anchors) | Insert a new anchor on the segment at the click point |
| Click on anchor (no drag) | Select that anchor (replaces selection unless shift) |
| Shift + click on anchor | Add/remove that anchor from selection |
| Drag on empty inside the edit-mode tint background | Marquee — selects anchors whose points fall inside |
| Backspace / Delete | Delete selected anchors; adjacent segments fuse |
| Arrow keys | Nudge selected anchors 1px (10px with shift) |
| Scissors — alt+click on anchor (no drag) of a closed path | Opens the path at that anchor (`closed → false`, anchors rotated) |

The alt modifier is overloaded across two gestures: **alt + drag-handle** breaks smoothness; **alt + click-anchor-no-drag** is scissors. The hit kind (`handle` vs `anchor`) plus the drag-vs-click distinction disambiguates — the route table has separate rows.

### Visual treatment

Background of the canvas container gets a CSS class (`pen-edit-active`) that applies a subtle tint. Default tint is implementation-detail; consumer can override.

Anchor overlay (drawn in the existing `penPreviewLayer`):

- Each anchor: a 6px-screen-space square. Hollow when unselected, filled when selected.
- For *selected* anchors only: lines from the anchor to its in/out handle endpoints + small circles at the handle endpoints. (Reduces visual clutter for paths with many anchors.)
- 1.5px stroke for anchor squares; 1px stroke for handle lines.

The path itself renders normally — same fill, same stroke. Other objs on the canvas are not dimmed.

Cursor: pen-tool cursor unchanged when over empty/segment. When the pointer is over an anchor or handle (per the hit override), the route entry can call `ctx.setCursor` if a bespoke cursor is desired. Default cursor swap is enough for v1.

## Architecture

### Anchor model is derived, not persisted

The kit's source of truth is the `PolygonPath`. `PenAnchor[][]` is computed from the path on edit-mode entry and serialized back on every mutation. No new fields on `PathObj`.

Justification: every distinction in `PenAnchor` that isn't already in the path is either creation-time-only (`altBroken` controls anchor-placement mirroring during a gesture; meaningless once committed) or recoverable from path geometry. **Smooth vs corner is recoverable** as collinearity of `(inHandle, anchor, outHandle)`. The kit can detect this with a small tolerance (default 0.5° or 0.001 normalized cross product).

**Smoothness detection threshold.** An anchor is classified smooth iff the normalized cross product of `(anchor → inHandle)` and `(outHandle → anchor)` has magnitude `< 0.001` *and* both handle distances are non-zero. The 0.001 threshold corresponds to ~0.05° of angular deviation — well below visible. Anchors with one or both handles at zero length are corners by definition (no handle to align).

This is the same trade SVG forces every vector editor to make — SVG paths don't carry "this anchor is smooth" metadata, yet Illustrator round-trips through SVG without losing the distinction.

Edge case: a corner anchor with handles that happen to be coincidentally collinear gets recovered as smooth. Visually indistinguishable; the next handle drag would have been mirror-drag anyway, which is what the user would want. Not a real loss.

### Two new pure helpers in `features/paths/`

```ts
export function pathToAnchors(
  path: PolygonPath,
): { anchors: PenAnchor[][]; closed: boolean[] };

export function anchorsToPath(
  anchors: PenAnchor[][],
  closed: boolean[],
): PolygonPath;
```

Both are pure, individually testable, and reusable outside pen-edit (e.g., a future "simplify path" tool could consume them).

### Two more math helpers

```ts
export function splitCubicAtT(
  p0: Point, p1: Point, p2: Point, p3: Point,
  t: number,
): { left: [Point, Point, Point, Point]; right: [Point, Point, Point, Point] };

export function fitCubicThroughDeletion(
  prev: PenAnchor,
  next: PenAnchor,
): { c1: Point; c2: Point };
```

`splitCubicAtT` is De Casteljau subdivision — used by "add anchor on segment" and reusable for hit-test refinement, scissors-on-segment, path simplification, etc.

`fitCubicThroughDeletion` produces a best-fit cubic through `prev → next` using their surviving handles when an interior anchor is removed. The result is imperfect (the curve shifts slightly); this is the same compromise Illustrator's "Delete Anchor Point" makes and is acceptable.

### Pen tool extensions

`PenScratch` gains a mode + edit branch:

```ts
interface PenScratch {
  mode: 'create' | 'edit';

  // when mode === 'create' (existing fields unchanged):
  finishedSubpaths: PenSubpath[];
  current: PenSubpath | null;
  cursor: { x: number; y: number } | null;
  draggingHandleAt: number | null;
  closeHintActive: boolean;
  _pendingDown: { worldX: number; worldY: number; alt: boolean; shift: boolean } | null;
  _lastClick: { t: number; x: number; y: number } | null;

  // when mode === 'edit' (new):
  edit: {
    objId: string;
    anchors: PenAnchor[][];      // per-subpath, derived on entry
    closed: boolean[];            // per-subpath
    selectedAnchors: Set<string>; // "subpathIdx:anchorIdx" keys
    activeHandle: { sub: number; anchor: number; side: 'in' | 'out' } | null;
    dirty: boolean;               // true after any mutation; gates the trapdoor commit
    // For trapdoor: snapshot of pre-conversion path + params so the first mutation
    // can record before/after in a single op.
    preConvert: { path: Path; params: PathParams | undefined; closed: boolean } | null;
  } | null;
}
```

### Tool-provided hit-test override (new kit primitive)

The dispatcher today resolves a pointer to a target string from two hardcoded categories: `node` (over an obj's bbox) and `empty` (anywhere else). Pen-edit needs richer targets: `anchor`, `handle`, `segment`. We add **one** hook to the tool API:

```ts
interface Tool<…> {
  // existing fields…

  /** Optional. When set, the dispatcher consults this before its built-in
   *  node/empty test. If it returns a value, that target name wins. */
  hitOverride?: (ctx: ToolCtx<…>) => { target: string; extra?: unknown } | null;
}
```

These target strings are entirely the tool's vocabulary, scoped to itself. The dispatcher never learns what `anchor` means — it just hands the string to the route-table lookup. Another tool could define `gradient-handle`, `param-slider`, whatever.

The pen tool's hit override:

- If `scratch.mode !== 'edit'`, returns null (use default node/empty).
- Otherwise, in screen space: tests anchors first (~10px hit radius), then handles (~8px), then segments (curve-distance ≤ 4px). First hit wins.
- Returns `{ target: 'anchor', extra: { sub, anchor } }` etc.

### Route table additions

When `scratch.mode === 'edit'`:

```
anchor:  down        → claim, begin drag-anchor
handle:  down        → claim, begin drag-handle (alt mod: break smoothness)
segment: click       → add anchor on segment at click point
*:       click       → exit edit mode (commit + clear edit branch)
empty:   down+drag   → exit edit, fall through to normal pen behavior
```

When `scratch.mode === 'create'` (the existing routes): unchanged.

The pen tool has **two separate route tables**, one per mode. `defineTool` is called once but the active table is chosen by reading `scratch.mode` in the tool's `routes:` evaluation (or wrapping `defineTool` to accept `{ create: …, edit: … }` if the implementation finds a clean factoring). Two tables beats one keyed-on-mode table because the action sets in each mode share zero rows.

### Op model

All anchor-level mutations commit through a single existing op pattern that atomically replaces `path`, `closed`, and (when nulling during trapdoor) `params` on a `PathObj`. No new op types are needed if the kit already has a "set path obj fields" op; otherwise we add one — `createSetPathOp` — that takes a partial of the geometric fields.

**Coalescing.** Drag gestures (anchor or handle) emit op updates via the existing coalesce window so one pointer-down → pointer-up is one undo entry. Arrow-key nudges emit one op per keystroke (held arrows = many small undo entries, which is fine; coalescing held-key into one entry is iffy in either direction).

**Trapdoor commit.** When the obj being edited is parametric:

- On `dblclick`-to-enter: derive anchors, populate `scratch.edit.preConvert`, but **do not** commit any op yet.
- On the first mutation: the committing op clears `params`, sets `closed` per derivation, and replaces `path` with the freshly-serialized polygon — all in one batch with the mutation itself.
- On exit without any mutation (`!scratch.edit.dirty`): no op fires. The rect stays a rect.

This is a deliberate walkback from the brainstorm's "convert immediately on entry" idea: the no-mutation-no-op behavior is just better UX, and the dirty bit cost is trivial.

## Data flow

```
double-click pen-tool on PathObj
  ↓
hitOverride returns null (parent not in edit mode yet)
  ↓
dispatcher reports `node`
  ↓
pen tool's `node: dblclick` route fires
  ↓
action: derive anchors via pathToAnchors; set scratch.mode='edit',
        scratch.edit = {...}, preConvert=… (if parametric); render bumps tint class
  ↓
overlay renders anchor squares + handle lines for selected anchors
  ↓
[user gesture]
  ↓
hitOverride returns 'anchor' / 'handle' / 'segment' based on pointer
  ↓
route fires action
  ↓
action mutates scratch.edit.anchors, sets scratch.edit.dirty=true
  ↓
action calls anchorsToPath, packages an op with the resulting path
  + (if first mutation on parametric) preConvert's params=undefined
  ↓
history coalesces the op into the current drag window
  ↓
on gesture end (pointer up / key release): coalesce window closes,
  one undo entry pushed
  ↓
[exit]
  ↓
exit action: scratch.mode='create', scratch.edit=null; tint class drops
```

## Components

| Component | Lives in | Responsibility |
|---|---|---|
| `pathToAnchors` | `src/features/paths/anchors.ts` (new) | Pure: `PolygonPath` → anchor model |
| `anchorsToPath` | `src/features/paths/anchors.ts` (new) | Pure: anchor model → `PolygonPath` |
| `splitCubicAtT` | `src/features/paths/cubicMath.ts` (new) | Pure: De Casteljau subdivision |
| `fitCubicThroughDeletion` | `src/features/paths/cubicMath.ts` (new) | Pure: best-fit replacement cubic |
| `hitOverride` hook | `src/tools/types.ts` + `src/tools/routing/dispatcher.ts` | Kit primitive: tool-provided hit-test |
| Pen edit module | `src/tools/builtin/penEdit/` (new dir) | Pen tool's edit-mode action handlers, hit-override, scratch helpers |
| Pen preview layer extension | `src/features/paths/penPreviewLayer.ts` (existing) | Adds the edit-mode anchor overlay rendering |
| `pen-edit-active` CSS class | Consumer side (Swillustrator first; kit can ship a default stylesheet later) | Background tint |

The pen tool's main file (`useUserPenTool.ts`) imports from `penEdit/` and conditionally wires it in based on `scratch.mode`. Route table is split between the file and the edit submodule for clarity.

## Testing

- **`pathToAnchors` / `anchorsToPath` round-trip.** For a battery of hand-built paths (single L, single Q, single C, multi-subpath, closed, with-trailing-Z, with-only-M), assert `anchorsToPath(pathToAnchors(p)) deepEquals p` after canonicalization (we may need a `canonicalizePolygonPath` helper that normalizes equivalent representations — e.g., trailing Zs).
- **Smooth/corner detection.** Construct paths where two adjacent `C` segments share an anchor with collinear handles → anchor recovers as smooth. With non-collinear handles → corner. Threshold edge cases (just-collinear, just-not).
- **`splitCubicAtT` correctness.** For known cubics, assert subdivision points at `t=0`, `t=0.5`, `t=1` produce expected fragments. Verify that re-joining `left` and `right` reproduces the original curve in geometry.
- **`fitCubicThroughDeletion`.** For curves with a known three-anchor configuration, assert the post-deletion two-anchor cubic stays within a numeric tolerance (e.g., Hausdorff distance ≤ 1px in unit-square coords) of the original three-anchor curve sampled at evenly-spaced `t`s.
- **Edit mode entry/exit.** Pen tool integration tests: dblclick obj → scratch.mode flips. Escape / empty-click / tool-switch → mode flips back. Pre-convert population on parametric objs; no-mutation-no-op behavior.
- **Trapdoor.** Enter edit on rect, escape immediately → no undo entry. Enter, drag a corner, exit → one undo entry, which reverts to the original rect+params on undo.
- **Hit override.** Mock the dispatcher to verify `hitOverride` is consulted, its return value takes precedence over built-in node/empty, and null means "fall through."
- **Each mutation operation.** Drag anchor — anchor moves, handles travel proportionally. Drag handle — anchor stays, handle endpoint moves. Alt+drag handle — opposite handle stays (corner conversion). Click on segment — new anchor inserted, segments split correctly. Delete — anchor removed, surviving segment passes near where the original curve was. Marquee — anchors inside rect get selected. Arrow-nudge — selected anchors translate by 1px / 10px-with-shift.
- **Visual overlay rendering.** Snapshot or DOM-inspection test: anchor squares drawn at correct positions, handles only visible for selected anchors.

## Open questions deferred to implementation

- Exact tint color for `pen-edit-active`. Iterable in CSS.
- Exact hit radii. Reasonable defaults (10 / 8 / 4 px screen-space) but tunable.
- Whether `hitOverride` returns `{ target, extra }` or whether `extra` rides on the `ToolCtx` for the routed action to read. Implementation can pick.

## Out of scope (for this spec)

- Persisting per-anchor metadata across edit sessions (e.g., a hand-written corner-vs-smooth flag that overrides collinearity detection). The collinearity-driven model is correct for our needs.
- Live shapes (parametric obj-ness preserved through anchor edits).
- A direct-selection tool separate from pen.
- Bezier-handle-snap, anchor-snap, smart guides during edit.
- Multi-object anchor selection.
- Path-pathfinder operations from within edit mode.
