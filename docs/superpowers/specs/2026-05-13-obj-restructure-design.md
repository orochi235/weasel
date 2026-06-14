# Obj Restructure Design — Tool Discriminator + Rect-as-Path + Params

**Status:** design
**Supersedes:**
- `docs/superpowers/specs/2026-05-13-rect-as-path-design.md`
- `docs/superpowers/specs/2026-05-13-pathobj-params-design.md`

## Goal

Restructure Swillustrator's `Obj` discriminated union in one coherent sweep:

1. **Collapse `RectObj` into `PathObj`** — rectangles become `PathObj`
   whose `path.kind === 'rect'` (the kit's `RectPath`). The rect
   fast-path stays implicit via `scalePathToBounds`'s `RectPath`
   pass-through.
2. **Replace `kind` with `tool`** as the top-level discriminator. `tool`
   names the *authoring origin* (`'rect' | 'ellipse' | 'polygon' | 'star'
   | 'line' | 'pen' | 'pencil' | 'text' | 'imported'`) and carries
   semantic intent for the LayerList, future re-edit handles, and SVG
   round-trip.
3. **Add `params?` for non-bounds-derivable shape parameters** — sides
   for regular polygon, points + ratio for star. `params` is *not* a
   discriminator (the `tool` field already covers that); it is
   parameter storage only, and is `undefined` for shapes whose
   geometry is fully determined by bounds (rect, ellipse, line, pen,
   pencil).

The two prior plans (rect-as-path collapse + `params` metadata) are
tightly coupled because each one rewrites the `Obj` union. Doing them
separately would require two passes over every `obj.kind === 'rect'`
site (60 hits — see Survey) and two rounds of test-fixture edits. The
consolidated plan rewrites the union once, with `tool` introduced as
the new discriminator from the start so we don't churn `kind →
something else → tool`.

## Non-Goals

- **No kit changes.** `Path = PolygonPath | RectPath` in
  `src/features/paths/types.ts` is already correct. No new kit-side
  discriminator. No `Path.params`. No parametric `Path` subtype.
- **`TextObj` stays a distinct variant.** It carries `text: string`
  plus `TextStyle` (fontSize, align, lineHeight, runs). Folding it into
  PathObj buys nothing. The new union is `PathObj | TextObj`, with
  `tool` as the discriminator: `tool === 'text'` is the test for "is
  this a TextObj".
- **No third discriminator.** TypeScript narrows via the `tool` union
  alone — no need for a parallel `kind: 'text' | 'path'` field.
- **No migration of saved scenes.** Swillustrator is pre-1.0; the SVG
  format hasn't shipped. Existing in-the-wild Swillustrator-saved SVGs
  (which emit `<path>` for rects today) round-trip via the path-then-rect
  detector already in `svgInterop.ts`; we just infer the new `tool`
  field on import (see Migration § below).
- **No `<rect>` emit on SVG export.** Rect-origin PathObjs continue to
  serialize as `<path d="M…">`. A future optimization could emit
  `<rect>` for axis-aligned `RectPath` but breaks byte-identical
  round-trip with existing fixtures.
- **No parametric re-edit UI.** This spec ships *storage* for `params`
  only — the "drag star points / change polygon sides" UI is a
  follow-up that consumes `params`. Out of scope.
- **No drift detection or geometry regeneration.** A user who nudges a
  vertex of a star-origin PathObj produces geometry that's no longer a
  pure star. `tool: 'star'` and `params: { points, ratio }` still say
  "star, 5 points, ratio 0.5"; the rendered coords drift; that's
  acceptable. The source-of-truth for rendering is
  `PathObj.path.coords` (or `RectPath`'s x/y/w/h).

## Survey (preserved from superseded plans)

`grep -rn "kind === 'rect'\|kind: 'rect'"
/Users/mike/src/weasel/apps/swillustrator/src/` reports **60 hits**:

- `App.tsx` — ~22 hits across `commitInsert`, `commitPaste`, `cloneNode`,
  `createPathNode`, `drawGhost`, `drawOne` (clone), `pathForObj`,
  `rectLayer`, eyedropper `colorOf`, fill/stroke selection patchers,
  primary-shape readers, `pickEvery` rotated-AABB filters.
- `svgInterop.ts` — 5 hits (`RectObj` interface, `objToSvgNode`'s rect
  branch, import side's rect-creation branch).
- `poseUpdate.ts` — 3 hits (interface declaration, the union, the
  `scalePathToBounds` call's `kind: 'rect'` literal for target bounds).
- `kindIcons.tsx` — 2 hits (`KindIcon` switch + dispatch type).
- Tests — `rotateUndo.test.ts` (1), `poseRotation.test.ts` (3),
  `svgInterop.test.ts` (~20+), `rotationRender.test.ts` (1 — already
  uses the post-state `kind: 'path' / path: { kind: 'rect' }` shape).

Post-restructure, every `obj.kind === 'rect'` site is rewritten as
either `obj.tool === 'rect'` (when tool-identity matters) or
`obj.path.kind === 'rect'` (when fast-path geometry matters). The
remaining matches of `kind: 'rect'` are exclusively inside `RectPath`
literals.

Note: `useRectTool` (in the kit) is **not** what Swillustrator uses for
the "R" key — the app wires `useInsertTool` to its `Obj`-shaped
adapter, and `adapter.commitInsert` is what mints the rect Obj on drag
release. The kit-side `useRectTool` is demo/library code, unaffected.

Today, Swillustrator does not record parametric origin **anywhere** —
the shape tools' `create` factories receive `sides` / `points` / `ratio`
and discard them immediately after building the polygon coords. This
restructure introduces the first parametric-origin discriminator.

## Before / After: the `Obj` Union

### Before

```ts
// poseUpdate.ts
export type Kind = 'rect' | 'text' | 'path';
export interface BaseObj { id: string; kind: Kind; x: number; y: number; width: number; height: number; rotation?: number }
export interface RectObj extends BaseObj { kind: 'rect'; fill: string; stroke: string; strokeWidth: number }
export interface TextObj extends BaseObj { kind: 'text'; text: string; style?: TextStyle }
export interface PathObj extends BaseObj { kind: 'path'; path: PolygonPath; closed: boolean; fill: string; stroke: string; strokeWidth: number }
export type Obj = RectObj | TextObj | PathObj;
```

### After

```ts
// poseUpdate.ts
import type { Path, TextStyle } from '@weasel-js/core';

export type ToolKind =
  | 'rect' | 'ellipse' | 'polygon' | 'star' | 'line'
  | 'pen' | 'pencil' | 'text' | 'imported';

/** Non-bounds-derivable shape parameters. Bounds-derived params (e.g.
 *  ellipse rx/ry, polygon outer radius, line endpoints) are NOT stored
 *  — they're derived from x/y/width/height. Pencil/pen/rect/ellipse/line
 *  have no extras and leave `params` undefined. */
export type PathParams =
  | { sides: number }                  // polygon
  | { points: number; ratio: number }; // star

export interface BaseObj {
  id: string;
  tool: ToolKind;
  x: number; y: number; width: number; height: number;
  rotation?: number;
}

export interface PathObj extends BaseObj {
  tool: Exclude<ToolKind, 'text'>;
  path: Path;                  // PolygonPath | RectPath
  closed: boolean;
  fill: string;
  stroke: string;
  strokeWidth: number;
  params?: PathParams;
}

export interface TextObj extends BaseObj {
  tool: 'text';
  text: string;
  style?: TextStyle;
}

export type Obj = PathObj | TextObj;
```

Type-level changes:

1. **`tool` replaces `kind`** as the top-level discriminator. Every Obj
   carries `tool`. TypeScript narrows via the union (`tool === 'text'`
   narrows to `TextObj`; any other value narrows to `PathObj`).
2. **`PathObj.path: Path`** widens from `PolygonPath` to
   `PolygonPath | RectPath`. The kit already has these.
3. **`RectObj` is gone.** A rect is a `PathObj` with `tool: 'rect'` and
   `path: { kind: 'rect', x, y, width, height }`.
4. **`PathParams`** is a discriminator-free shape — `tool` already
   discriminates origin, so `params` is just an optional extras bag
   keyed by the shape's own field names (`sides`, `points`, `ratio`).
   TypeScript's type narrowing on `params` works via "has `sides`?"
   etc., not via a redundant inner `kind`.

`PathObj.closed` stays required (every site that constructs a PathObj
already sets it explicitly; rect-origin PathObjs pass `closed: true`).

## `tool` vs. `path.kind` — when to test which

- **`obj.tool === 'rect'`** — "this object was created by the rect
  tool" — used by the LayerList icon picker (RectIcon for rect-tool
  shapes), future "convert rect-tool shape to ellipse" affordance, and
  any other authoring-intent UX.
- **`obj.path.kind === 'rect'`** — "this object's geometry is currently
  a `RectPath`" — used internally for fast-path math (avoiding polygon
  AABB scan, exact corner pick). Most existing sites that say `obj.kind
  === 'rect'` today are checking authoring intent and become `obj.tool
  === 'rect'`; a smaller subset (geometry shortcuts in `pathLayer` /
  bounds-only paths) become `obj.path.kind === 'rect'`. The plan walks
  each site and labels which.

A non-axis-aligned edit could one day promote a rect's `RectPath` to a
`PolygonPath` (e.g. dragging a single corner). After such an edit,
`obj.tool === 'rect'` still holds, but `obj.path.kind === 'polygon'`.
This is the "drift" case from the params spec: tool identity persists
across geometry edits.

## `params`: shape, lifecycle, source-of-truth

### Shape

```ts
type PathParams =
  | { sides: number }                  // tool === 'polygon'
  | { points: number; ratio: number }; // tool === 'star'
```

`ratio = innerRadius / outerRadius` (the `innerRatio` convention used
by `useStarTool`'s options). No `kind` discriminator inside `params` —
`tool` already discriminates.

### Source-of-truth rule

`PathObj.path` (`PolygonPath.coords` or `RectPath` x/y/w/h) is
canonical. Rendering, hit-test, boolean-ops, marquee/lasso
intersection, `scalePathToBounds`, and SVG serialization all read from
`path`. `params` is **annotation** — read only by future "re-edit
parametrically" tools.

Consequences:

- **Resize doesn't regenerate from `tool + params`.** `scalePathToBounds`
  runs on the existing path (RectPath or PolygonPath). A 100×100
  star resized to 200×100 stays a star-shaped polygon scaled
  non-uniformly — what Illustrator-style users expect.
- **Drift is allowed.** A user who direct-selects one vertex of a
  star-origin polygon and drags it produces geometry that's no longer a
  pure star. `tool: 'star'` and `params: { points: 5, ratio: 0.5 }`
  still say "star, 5 points, ratio 0.5"; the rendered coords drift;
  that's fine. A future re-edit tool can best-effort re-fit.
- **No invariant** that "current coords must match params-regenerated
  coords." svgInterop doesn't validate; tests don't assert.
- **Boolean ops drop params.** Boolean code constructs fresh `PathObj`s
  and won't set `params` or any specific `tool` — they get
  `tool: 'imported'` (or a new dedicated value if we add one later;
  scope decision below punts this to a follow-up).

### Why store `params` if drift is allowed?

The common case is "user dragged out a star, later wants to change it
from 5 points to 7." That case needs the points count, and there's no
reliable way to recover it from coordinates alone after non-uniform
resize. Drift is the exception, not the norm.

### Why `tool` carries the authoring origin separately from `params`

- **`tool` is always present.** Every PathObj names the tool that
  created it. Imported third-party SVG paths get `tool: 'imported'`.
- **`params` is optional.** Only polygon and star have parameters that
  aren't bounds-derived; for everyone else, `params` is `undefined`.
- This split matches LayerList needs: the icon picker reads `tool`
  alone (it doesn't care about sides or ratio). A future "edit star
  inner radius" tool reads `tool === 'star'` to enable the affordance
  and `params` to drive it.

## Tools that write `tool` (and `params` where applicable)

| Tool | `tool` field | `params` |
|--|--|--|
| `useInsertTool` (R-key, via `adapter.commitInsert`) | `'rect'` | — |
| `useEllipseTool` | `'ellipse'` | — |
| `usePolygonTool` (or Swillustrator's `useUserPolygonTool` consumer wrapper) | `'polygon'` | `{ sides }` |
| `useStarTool` (or `useUserStarTool` consumer wrapper) | `'star'` | `{ points, ratio }` |
| `useLineTool` | `'line'` | — |
| `useUserPenTool` | `'pen'` | — |
| `usePencilTool` | `'pencil'` | — |
| `useTextTool` | `'text'` | n/a (TextObj) |
| `svgInterop` imports without `swill:tool` | `'imported'` | — |
| Boolean ops (union/subtract/intersect/exclude) producing fresh PathObjs | `'imported'` | — |

The kit's tool factories take a consumer-supplied
`create: (...) => TNode | null` callback. The kit doesn't impose
`tool` or `params` shape — Swillustrator's `pathToObj` factory in
`App.tsx` is extended to accept a `tool: ToolKind` arg (and optional
`params: PathParams`) and write them onto the produced `PathObj`.

## SVG encoding

Per the 2026-05-12 svg-native design (§ "Encoding rule": *prefer
namespaced attributes on standard SVG elements*), `tool` and `params`
ride on `SvgPathNode.meta.swill.attrs` — the same channel used today
for `swill:line-height` on text and `swill:group-id` on groups. **Zero
new infrastructure** in weasel-svg.

Concrete attributes:

| Origin | Attributes |
|--|--|
| rect | `swill:tool="rect"` |
| ellipse | `swill:tool="ellipse"` |
| polygon | `swill:tool="polygon"`, `swill:params-sides="6"` |
| star | `swill:tool="star"`, `swill:params-points="5"`, `swill:params-ratio="0.5"` |
| line | `swill:tool="line"` |
| pen | `swill:tool="pen"` |
| pencil | `swill:tool="pencil"` |
| text | `swill:tool="text"` (on `<text>` node) |
| imported | (no `swill:tool` attr — parser falls back to `'imported'`) |

Numeric values serialize via `String(n)` and parse via `parseFloat`.
Invalid / missing required values for a given `tool` cause the
`params` field to be dropped on import (silently — the rendered path
is fine without it). An unknown `swill:tool` value (e.g. from a future
version of Swillustrator) parses to `tool: 'imported'`.

Encoding lives entirely in `apps/swillustrator/src/svgInterop.ts`:
`objToSvgNode` writes the attrs into `meta.swill.attrs` on the
`SvgPathNode` / `SvgTextNode`; `svgNodesToObjsWithGroups` reads them
back. weasel-svg sees opaque namespaced attrs and round-trips them
unchanged.

## LayerList implications

`kindIcons.tsx` today exports `RectIcon`, `TextIcon`, `PathIcon`,
`PageIcon`, plus a `KindIcon` dispatch by `'rect' | 'text' | 'path'`.

Post-restructure, the dispatch keys on `obj.tool`. **Five new icons are
needed** to distinguish authoring origins in the row list:

- `EllipseIcon` (circle)
- `PolygonIcon` (hexagon outline)
- `StarIcon` (5-point star outline)
- `LineIcon` (diagonal line with two anchor dots)
- `PenIcon` (bezier curve with one off-curve handle)
- `PencilIcon` (squiggle — distinct from `PathIcon`'s curve-with-anchors)
- (`PathIcon` is repurposed as the `'imported'` and fallback icon.)

Specifically, `pencil` (freehand) vs. `pen` (bezier authoring) deserve
distinct icons since they're visually distinguishable in the result. T9
adds these alongside the existing `RectIcon` / `TextIcon` / `PathIcon`.

## Migration

**Type-level:** none required. Swillustrator is pre-1.0; no shipped
consumers.

**SVG-level:** existing Swillustrator-saved SVGs round-trip via the
existing path-then-rect detector in `svgInterop.ts`. For shapes
without a `swill:tool` attr (i.e. anything saved before this change,
or any third-party SVG):

- If `path.kind === 'rect'` (the import-side rect detector fired) →
  infer `tool: 'rect'`.
- Otherwise → `tool: 'imported'`.

This keeps round-trip stable for the rect-fast-path case (the common
existing-file case) and gives third-party imports a sensible identity.

## Acceptance Criteria

1. **Type-level:** `grep "kind: 'rect'"` and `grep "kind === 'rect'"`
   in `apps/swillustrator/src/**.ts(x)` return only matches inside
   `RectPath` literals (`path: { kind: 'rect', ... }` or DrawCommand
   inline shadows). No `Obj`-level matches remain.
2. **No `obj.kind` references on `Obj`.** `grep "obj.kind\|o.kind\|\.kind ===" ` in Swillustrator turns up only `path.kind` or
   `SvgNode.kind` references; no `Obj.kind` survivors.
3. **Every shape tool writes `tool`.** Polygon and star also write
   `params`. Tested via integration test that drives each tool and
   asserts the produced PathObj.
4. **Visual parity:** every shape kind (rect, ellipse, polygon, star,
   line, pen, pencil, text) renders identically before/after.
5. **Resize/move/rotate:** corner-resize on a rect-origin PathObj
   keeps `path.kind === 'rect'` (no spurious polygon promotion).
6. **Rect-fast-path:** `applyPoseToObj` on a `tool: 'rect'` PathObj
   produces a `RectPath` (not a polygon) at the new bounds. Pinned by
   a unit test.
7. **SVG round-trip:** save → load → save preserves `tool` + `params`
   for every shape kind. The four parametric shapes (ellipse, polygon,
   star, line — though only polygon/star have non-empty params) plus
   pencil and pen round-trip with their authoring `tool`; pencil and
   pen come back with `params: undefined`.
8. **Imported third-party SVG:** a `<path>` without `swill:tool`
   imports as `tool: 'imported'`; a `<rect>` (or `<path>` with
   axis-aligned d-string) without `swill:tool` imports as
   `tool: 'rect'` (rect-detector path).
9. **LayerList icons:** ellipse, polygon, star, line, pen, pencil,
   rect, text, imported each show a distinct icon. Visual snapshot in
   the LayerList test (or manual confirmation in the smoke step).
10. **Booleans:** `useBooleans` still receives `RectPath` from
    `pathForObj` for rect-tool shapes (rect fast-path holds through
    boolean inputs).
11. **`tsc --noEmit && vitest run && tsup build` clean** (the
    prepublishOnly gate).

## Out of Scope / Follow-Ups

- **Parametric re-edit handles.** The "drag star points, change polygon
  sides" UI. The whole point of storing `params`. Separate spec.
- **Drift recovery.** Best-effort re-fit of edited coords to the
  closest params-defined shape — only relevant once re-edit handles
  exist.
- **Parametric origin inference for third-party imports.** A polygon
  imported from Inkscape with no `swill:tool` arrives as
  `tool: 'imported'`; we don't try to detect "this is a regular
  hexagon" from coordinates.
- **`<rect>` / `<ellipse>` SVG output** instead of `<path>`. Small
  size win, breaks byte-identical round-trip with existing fixtures.
  Punt until there's a reason.
- **Dedicated `tool: 'boolean'` value** for outputs of pathfinder ops.
  Today they get `tool: 'imported'`. If the LayerList wants to
  distinguish "this was produced by union" from "this was imported
  from Figma," add the value.
- **Promoting `RectPath → PolygonPath` on first non-axis-aligned edit**
  (e.g. dragging a single corner anchor via a future per-anchor edit
  tool). Out of scope until that tool exists. `tool: 'rect'` would
  persist across such an edit; `path.kind` would change.
- **`<swill:parametric>` element form** as an alternative to namespaced
  attrs. Reserved in the svg-native design; this spec deliberately
  picks the attribute form.

## Risk / Open Items

- **Pen / pencil bypass.** If someone wires `useUserPenTool` or
  `usePencilTool` through a custom factory that *does* set `params`,
  nothing structurally prevents it. The acceptance criteria explicitly
  test that the default Swillustrator wiring leaves `params` unset on
  these tools.
- **Star `ratio` precision.** Stored as a float. `String(0.5)` is
  `"0.5"`, `String(1/3)` is `"0.3333333333333333"`. Acceptable — a
  future re-edit slider has finite precision anyway.
- **Layer-z-order shift.** Merging `rectLayer` + `pathLayer` into a
  single layer changes the iteration order from "all rects, then all
  paths" to "everything in scene order." For files where the user
  drew rects before paths, no visible change. For files where the
  user interleaved, this restores correct paint order. Acceptance
  criterion #4 covers it; manual smoke confirms.
- **Future bezier-fitted ellipse `path`.** Today's ellipse is a
  4-cubic-bezier approximation stored as a polygon. `tool: 'ellipse'`
  annotates the intent independently of geometry encoding; if we ever
  switch to a true `<ellipse>` emit, `tool` stays valid.
