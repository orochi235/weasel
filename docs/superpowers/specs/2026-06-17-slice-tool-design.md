# Slice tool — design

**Status:** approved (brainstorm) — pending implementation plan
**Date:** 2026-06-17

## Summary

A WeaselDraw-specific **Slice** tool. The user drags a straight line across the
canvas; every closed path the drawn segment passes through is split into
separate closed pieces along the cut (Illustrator "Knife" semantics). The slice
line itself is ephemeral — it is a gesture/preview only and is never added to
the scene.

The cut geometry lives as a reusable, pure kit primitive; the tool (gesture,
overlay, scene scan, commit) is app-specific to `apps/draw`.

## Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| What does a cut produce? | **Knife** — each crossed shape becomes 2+ separate **closed** pieces, with new edges along the cut. Fills preserved on both pieces. |
| Which paths are affected? | **Every** crossed path in the scene, regardless of selection. |
| Gesture | **Straight drag A→B**, cut **only where the drawn (finite) segment actually crosses** — no infinite-line extension. |
| Does the line persist? | **No** — ephemeral cut; nothing added to the scene. |
| Cut-geometry approach | **A — half-plane boolean clip**, gated on the segment crossing the boundary ≥2× (enters and exits). |
| Geometry home | **Kit primitive** (`src/features/paths/`) + **app tool** (`apps/draw/src/tools/`). |

## Architecture

Two units with a clean boundary:

1. **Kit geometry primitive** — `splitPathByLine(path, a, b, opts?) → Path[] | null`
   in `src/features/paths/splitByLine.ts`. Pure (no React, no scene), fully
   unit-testable. Returns `null` when the finite segment `a→b` does not
   enter-and-exit the path boundary (`< 2` crossings); otherwise returns the
   closed pieces as `PolygonPath`s.

2. **WeaselDraw tool** — `apps/draw/src/tools/slice/useSliceTool.tsx`. Owns the
   straight-line drag gesture, the live preview overlay, the scene scan, and the
   undoable commit. Establishes the first `apps/draw/src/tools/` app-tool
   pattern (no app-specific tool exists yet; all tools currently come from the
   kit bundle).

## `splitPathByLine` (the crux)

Building blocks already in the repo:
- `extractPolylines(path, opts?)` (`src/features/paths/tessellate/polyline.ts`) — flatten to per-contour vertex rings.
- `boundsOfPath(path)` (`src/features/paths/bounds.ts`) — tight AABB.
- `pathIntersect(a, b)` (`src/features/paths/booleans.ts`, backed by `polygon-clipping`).
- `PathBuilder` / `polygonFromPoints` (`src/features/paths/builder.ts`).

Algorithm:
1. Flatten `path` to world-space polygon ring(s) via `extractPolylines`
   (béziers subdivided at `DEFAULT_FLATTEN_TOLERANCE`).
2. **Gate:** count intersections of the finite segment `a→b` against the
   boundary edges (parametric segment–segment test, written here — the repo has
   no general segment-intersection routine yet). `< 2` ⇒ return `null`.
3. **Cut:** from the line through `a→b`, build two large half-plane quads sized
   to the path's padded AABB (one per side). `pathIntersect(path, halfQuadLeft)`
   and `pathIntersect(path, halfQuadRight)` produce the two sides.
4. Emit one `PolygonPath` per resulting connected region, preserving `fillRule`.

Note on Approach A: step 3 uses the *infinite* line within a gated shape, so a
**concave** shape that the finite segment only partly crosses can be cut at
far-side crossings the stroke never reached. Accepted for v1; see non-goals.

## Tool behavior

- **Gesture:** straight drag A→B, mirroring `useLineTool`'s drag pattern
  (`src/tools/builtin/line/useLineTool.tsx`). Scratch holds the start point.
  Sub-threshold drags are ignored (no accidental click-cuts).
- **Overlay:** render the slice line as a live preview while dragging. Ephemeral
  — never inserted into the scene.
- **Commit (drag end):** scan every leaf path/rect node; map each node's
  geometry to world space; call `splitPathByLine`. For nodes that return pieces,
  accumulate `createDeleteOp(node, index)` + `createInsertOp(piece) × N`, each
  piece carrying over the original's **style (fill/stroke/opacity), parent, and
  layer**, inserted at the original's z-index. Commit all as one
  `ctx.applyOps(ops, 'Slice')` batch (single undo step).
- **Presentation:** label "Slice", knife cursor, shortcut `K`, grouped with the
  other shape tools.
- **Wiring:** `SceneCanvas tools={{ slice: useSliceTool(...) }}` in
  `apps/draw/src/App.tsx`, plus a `ToolPalette` entry.

## Scope / v1 non-goals (documented limitations)

- **Béziers flatten** to polylines on cut pieces (curve info lost). Curve
  re-fitting (`schneiderFit`) is a later enhancement.
- **Concave shapes** partly crossed may over-cut (Approach A tradeoff above).
- **Rotated poses:** `pathPoseDescriptor` has no rotation support. v1 bakes
  rotation into world geometry before splitting; if that proves fiddly during
  implementation, rotated nodes are **skipped** (decision deferred to impl).
- **Only closed/fillable leaf paths** (incl. `RectPath`). Containers, text,
  images, and open/stroke-only paths are skipped in v1.

## Testing

- **Kit unit tests** (`src/features/paths/splitByLine.test.ts`):
  - square sliced diagonally → 2 triangles;
  - non-crossing segment → `null`;
  - axis-aligned rect fully crossed → 2 pieces;
  - summed piece area ≈ original area (conservation);
  - `fillRule` preserved on pieces;
  - documented concave behavior pinned.
- **Tool tests** (`apps/draw`):
  - drag across one shape → 1 node replaced by 2;
  - multi-shape drag cuts every crossed shape;
  - ephemeral line is not persisted to the scene;
  - undo restores the original single node.

## Open seams for later

- Approach **B** (chord-split the boundary) for faithful finite-stroke cuts on
  concave shapes — `splitPathByLine` is the single swap point.
- Bézier-preserving cuts via parametric curve intersection + `schneiderFit`.
- Scissors mode (split open paths at crossings) and freehand/polyline cuts.
