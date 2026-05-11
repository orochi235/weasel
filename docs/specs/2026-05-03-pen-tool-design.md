# Pen tool design

**Date:** 2026-05-03
**Status:** Spec — ready for plan
**Predecessor specs:** `docs/specs/2026-05-03-tool-primitive-design.md` (Tool primitive), `docs/specs/2026-05-03-tool-primitive-phase-2c-design.md` (view-aware rendering, screen-space chrome)

## Goal

Ship `useUserPenTool` — an active-slot Tool that lets a user build a new
`PolygonPath` from scratch, click-by-click, with Illustrator-style
click-vs-drag (corner anchor vs smooth anchor with control handles).
Becomes the fifth tool in Swillustrator and the first non-trivial
content-creation tool in the kit.

## Architecture

The tool exposes two things:

1. **`useUserPenTool({ wrapPath, adapter, ... })`** — the Tool record
   itself (active slot, keybinding `P`, drag + click + key channels).
2. **`createPenPreviewLayer({ penTool })`** — a `space: 'screen'`
   `RenderLayer` factory the consumer drops into their `layers` map for
   in-progress preview chrome (rubber-band, anchor dots, handles,
   close-hint).

Both ship as separate exports for now. A future plugin convention can
bundle them into a `usePenPlugin()` once 2+ plugin-shaped features
exist (see TODO `Plugin/bundling convention`).

## Surface

### `useUserPenTool`

```ts
interface UseUserPenToolOptions<TPose> {
  /** Wrap a finished PolygonPath in the consumer's pose type. Called
   *  once per committed object (after Enter / tool-switch / etc). */
  wrapPath: (path: PolygonPath, opts: { closed: boolean }) => TPose;

  /** Insert the wrapped pose into the scene; return the new id so the
   *  pen tool can auto-select it after commit. */
  adapter: {
    addNode: (pose: TPose) => string;
    setSelection: (ids: string[]) => void;
  };

  /** Whether to auto-select the new object after commit. Default true. */
  autoSelect?: boolean;

  /** Screen-px hit radius for "click first anchor to close" detection.
   *  Default `8`. Same convention as `handleHitRadius` in selection chrome. */
  closeHitRadius?: number;
}

export function useUserPenTool<TPose>(
  opts: UseUserPenToolOptions<TPose>,
): Tool<PenScratch>;
```

### `PenScratch`

```ts
interface PenAnchor {
  x: number;
  y: number;
  /** Outgoing handle position (world coords), if this anchor was
   *  placed via click-drag. Undefined for corner anchors. */
  outHandle?: { x: number; y: number };
  /** Incoming handle, mirrored from the previous anchor's outHandle
   *  unless Alt-broken during the placement drag. */
  inHandle?: { x: number; y: number };
  /** True when Alt was held during the outgoing-handle drag — the
   *  next anchor's incoming handle is NOT mirrored from this one. */
  altBroken?: boolean;
}

interface PenSubpath {
  anchors: PenAnchor[];
  closed: boolean;
}

interface PenScratch {
  /** Subpaths already finished (closed via click-first-anchor or
   *  open-finished — only the final subpath may be open). */
  finishedSubpaths: PenSubpath[];
  /** In-progress subpath; null when in BetweenSubpaths or Idle state. */
  current: PenSubpath | null;
  /** Latest cursor position in world coords; used by the preview
   *  layer for rubber-band rendering. */
  cursor: { x: number; y: number } | null;
  /** Anchor index whose outHandle is being shaped (during the
   *  placement drag). Null when not mid-placement-drag. */
  draggingHandleAt: number | null;
  /** True when the cursor is within `closeHitRadius` of the current
   *  subpath's first anchor and there are ≥3 anchors (so closing
   *  produces a real shape, not a degenerate two-point loop). */
  closeHintActive: boolean;
}
```

### `createPenPreviewLayer`

```ts
interface CreatePenPreviewLayerOptions<TPose> {
  /** The Tool returned by useUserPenTool — the layer reads its
   *  scratch state to render preview chrome. */
  penTool: Tool<PenScratch>;
  /** Optional theme overrides; defaults to cream `#d4c4a8`. */
  style?: {
    anchorFill?: string;
    anchorStroke?: string;
    handleStroke?: string;
    rubberBandStroke?: string;
    closeHintFill?: string;
    finishedSubpathStroke?: string;
  };
}

export function createPenPreviewLayer<TPose>(
  opts: CreatePenPreviewLayerOptions<TPose>,
): RenderLayer<unknown>;
```

## State machine

| State              | Description                                                  |
|--------------------|--------------------------------------------------------------|
| **Idle**           | No path being built. `current === null`, `finishedSubpaths.length === 0`. |
| **Drawing**        | Subpath in progress. `current !== null`.                     |
| **BetweenSubpaths**| ≥1 finished subpath, no in-progress. `current === null`, `finishedSubpaths.length > 0`. |

### Transitions

| Input                                | Idle              | Drawing                                                  | BetweenSubpaths                              |
|--------------------------------------|-------------------|----------------------------------------------------------|----------------------------------------------|
| click empty space                    | → Drawing (start M, append corner anchor) | append corner anchor                  | → Drawing (start M, append corner anchor) |
| pointer-down + drag empty space      | → Drawing (start M, anchor + outHandle as drag) | append anchor + outHandle as drag | → Drawing (start M, anchor + outHandle as drag) |
| Alt held during placement drag       | —                 | sets `altBroken: true` on the placed anchor              | —                                            |
| Shift held during placement          | —                 | constrain new segment direction to 0/45/90/135°          | (applies once Drawing starts)                |
| click first anchor of current (≥3 anchors) | — | close (Z) → BetweenSubpaths                              | —                                            |
| Enter                                | — (no-op)         | open-finish current subpath + commit object → Idle       | commit object → Idle                         |
| Esc                                  | — (no-op)         | discard everything → Idle                                | discard everything → Idle                    |
| tool-switch (active slot leaves pen) | — (no-op)         | if ≥2 anchors: open-finish current + commit; else discard | commit (≥1 finished subpath); else discard  |
| pointer-move                         | update `cursor`   | update `cursor`; update `closeHintActive`; if mid-handle-drag, update outHandle of latest anchor | update `cursor` |

### Commit semantics

"Commit object" means:

1. Build a `PolygonPath` from `finishedSubpaths` (plus `current` if
   open-finishing). Each subpath emits an `M` for the first anchor,
   then `L` (corner) or `C` (smooth — control points come from
   anchor.inHandle and anchor.outHandle) per segment, then `Z` if closed.
2. Call `wrapPath(path, { closed: <true if all subpaths closed> })`.
3. Call `adapter.addNode(pose)` → get back the new id.
4. If `autoSelect !== false`, call `adapter.setSelection([newId])`.
5. Reset scratch to Idle state.

### Open-subpath constraint

Open subpaths are only allowed as the **last** subpath in a multi-contour
object. Enforced by the state machine: once the user open-finishes a
subpath, the next state is Idle (committed), not BetweenSubpaths.
To have an open subpath in the middle of a compound path the user
must close all prior subpaths. Documented as a known v1 limitation.

## Click-vs-drag detection

Standard threshold pattern (mirror `useInsertTool` if it has one):

- **Pointer-down:** record `(x, y)` and start time.
- **Pointer-move (before pointer-up):** if displacement < 4 CSS px,
  treat as click-in-progress (still open to becoming a drag);
  otherwise enter drag mode → start tracking outHandle.
- **Pointer-up:** if click mode, place a corner anchor at down-position;
  if drag mode, the anchor + outHandle are already placed, just commit.

The 4 px threshold matches existing kit conventions (TBD: confirm
against `usePointerGestures` defaults during plan).

## Shift-constrain

When Shift is held:

- During pointer-move (rubber-band): the *previewed* next segment
  direction is constrained to 0/45/90/135° from the previous anchor.
  The actual placement on pointer-down uses the constrained position.
- During placement drag (outgoing handle): the outHandle direction
  from the anchor is constrained to 0/45/90/135°.

Implementation: a `constrainTo45(dx, dy)` helper that snaps the
direction. Reusable beyond the pen tool.

## Cursor

`cursor: 'crosshair'` always, until the close-hint is active — then
switch to `'pointer'` (signalling the click-to-close affordance).
Tool's `cursor` field as a function of scratch state.

## Preview layer rendering

Reads `penTool.scratch` via the same channel `RenderLayer.draw` is
called with. Renders in `space: 'screen'` so handle/anchor sizes are
constant across zoom levels.

For each finished subpath: stroke its outline in
`finishedSubpathStroke` (default cream).

For the current subpath:

- Stroke the path so far in `rubberBandStroke`.
- Draw a circle (4 screen-px radius, filled `anchorFill`,
  stroked `anchorStroke`) at each anchor.
- For the latest anchor with an `outHandle`: draw a line from anchor
  to outHandle in `handleStroke` (1 px), and a small filled circle at
  the handle endpoint.
- If `cursor !== null` and not mid-handle-drag: draw the rubber-band
  segment from the latest anchor to the cursor (or the curved
  preview if the latest anchor has an `outHandle`).
- If `closeHintActive`: highlight the first anchor with a larger ring
  in `closeHintFill`.

All coords go through `worldToScreen(...)` since the layer runs in
`space: 'screen'`.

## Tests required

- `useUserPenTool.test.tsx`:
  - declares id 'pen', keybinding 'P', cursor function
  - click → place corner anchor; click again → place second corner
  - pointer-down + drag → anchor with outHandle
  - click first anchor (≥3 anchors) → close subpath, transition to BetweenSubpaths
  - click first anchor (<3 anchors) → no-op (degenerate)
  - Enter in Drawing → commit object via adapter; auto-select
  - Enter in BetweenSubpaths → commit
  - Esc → discard everything
  - tool-switch with ≥2 anchors → commit; <2 → discard
  - Shift held → constrain to 45° (test the rubber-band position)
  - Alt held during drag → mark altBroken on the anchor
  - autoSelect: false → no setSelection call

- `createPenPreviewLayer.test.ts`:
  - Renders nothing in Idle state
  - Renders anchor circles per anchor
  - Renders rubber-band from latest anchor to cursor
  - Renders curve preview when latest anchor has outHandle
  - Renders close-hint when closeHintActive
  - All draw calls use screen-px coords (verified by stubbing
    worldToScreen and asserting on outputs)

- Integration smoke in Swillustrator demo: switch to pen, draw a
  3-anchor open path, hit Enter, verify a new object lands in items.

## Deferred / out of scope

Tracked in `docs/TODO.md` under "Tool primitive follow-ups":

- **Snap-to-grid during pen creation.** Today anchors land at raw
  cursor coords; consumer's `gridSnapStrategy` is ignored. Needs
  design pass on whether the rubber-band also snaps.
- **Snap-to-existing-anchors** (cross-path anchor snapping). Useful
  for stitching paths together; out of v1.
- **Mid-creation editing of placed anchors.** Append-only in v1;
  to fix mistakes, finish and use BezierEdit. Adding drag-on-placed-anchor
  during creation embeds BezierEdit into the create gesture (significant scope).
- **Continue an existing path's open endpoint.** Pick up an existing
  open path's first/last anchor with a click and append. Not in v1.
- **Compound-path with open middle subpath.** Currently open subpath
  must be the last; multi-contour with mixed open/closed in arbitrary
  order would need a third Enter meaning (or a separate keybind).
- **Double-click last anchor to open-finish** (Illustrator convention).
  v1 uses Enter only.
- **Cmd+click-off to open-finish** (Illustrator convention). v1 uses
  Enter only.
- **Click-on-existing-anchor-to-edit during creation** — same scope as
  mid-creation editing, deferred together.

## Files to create / modify

- Create: `src/tools/builtin/useUserPenTool.ts`
- Create: `src/tools/builtin/useUserPenTool.test.tsx`
- Create: `src/features/paths/penPreviewLayer.ts`
- Create: `src/features/paths/penPreviewLayer.test.ts`
- Create: `src/util/constrainTo45.ts` (small helper, exported)
- Create: `src/util/constrainTo45.test.ts`
- Modify: `src/tools/builtin/index.ts` (re-export)
- Modify: `src/index.ts` (re-export)
- Modify: `demo/demos/SwillustratorDemo.tsx` (add pen tool to palette)
- Modify: `docs/TODO.md` (move Pen tool entry from "Tool primitive
  follow-ups" to under "shipped"; add the deferred items above)
