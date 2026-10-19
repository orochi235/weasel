# Snapping

How every gesture in weasel finds what to snap to, picks one answer, and shows it. For someone
adding a snap target, wiring snapping into a host, or writing an action that snaps. It covers the
model the resolver works on, how it ranks, how to write a source, the modifier roles, the readout,
and how a 3D host uses the same pipeline.

## The pieces

| Piece | What it is | Where |
|---|---|---|
| `snap` dep | `begin(req)` → a session; every snapping action calls it at press | `SnapDep`, core |
| session | `at(point, mods)` each frame for a point, `angle(theta, mods)` for an angle, `end()` on release | `SnapSession`, core |
| source | one kind of target: a grid, guides, path anchors, sibling edges | `SnapSource`, core and the packages that own the geometry |
| resolver | ranks every source's candidates together and returns one move | `resolveSnap`, `@weasel-js/geom/nd` |
| readout | one layer that draws what the result met | `createSnapReadoutLayer`, mounted by every `<SceneCanvas>` |

A gesture never talks to a source. It hands the session the point the dispatcher gave it and gets
back the point it should use. Points are ctx coordinates: world in 2D, screen in a 3D host.

Gestures that snap: move, resize, rotate, insert (drag and click-place), pen and spiro placement,
pen handles, anchor and handle drags in path edit, measure, and the symmetry center and axis.

## The model

A gesture's raw move from the press is `δ₀`. The session looks for a `δ` near it.

**Probes** are points on the subject that should land on something. Each has a role, and a source
is only ever offered probes of the roles it names:

| Role | Probes | Typical sources |
|---|---|---|
| `origin` | each moved root's pose origin, read through an `OriginProjection` | grid, ruler guides |
| `box` | the subject's drawn box (stroke included): its min, center and max corners; on a resize, the moving edges | alignment, equal spacing |
| `geometry` | the point of the subject's own outline nearest the press, on a move | path targets, 3D boxes |
| `pointer` | the pointer, for point gestures; the dragged corner, for a resize | every source |

**Loci** are where a target allows a probe to be: a point plus zero, one or two directions — a
point, a line, or a plane. A locus may carry a span (a segment, a bounded face); a result outside
it fails. A path anchor is a point; an alignment edge, a ruler guide or one axis of a grid is a
line; a 3D box face is a plane.

A **candidate** is one locus offered for one probe. Since a move shifts every probe by the same
`δ`, each candidate constrains `δ` to an affine subspace whose codimension is the locus's.

**The input subspace `H`** is where `δ` must stay whatever is snapped:

| Gesture | `H` |
|---|---|
| move, point gesture | the whole plane |
| Shift (`snap.constrain`) on a move or an anchor drag | the line through the press at the nearest multiple of 45° |
| Shift on a line insert, a measurement, a rotate, a symmetry axis | the nearest multiple of 15° (`SNAP_ANGLE_STEP`) about the start or pivot |
| Shift on a pen handle | the nearest multiple of 45° about its anchor |
| Shift on a resize corner | the box's diagonal through the fixed corner |
| resize edge handle | the handle's axis |
| 3D move | the plane through the subject perpendicular to `up` |

Snapping within `H` is an intersection, so a constraint and a snap never disagree: Shift on a
line insert lands where the 15° line meets a guide.

A rotate, the symmetry axis, and a control handle under path-tools' handle snap run the same
resolver in one dimension: `δ` is an angle, targets are angles, and reach is turned into radians
through the press's distance from the pivot, capped at 30° near the pivot.

## Ranking

Reach is measured in screen pixels. The kit setting `targets.snapPx` (default 8) is every source's
reach unless the source sets `reachPx`; `<SceneCanvas snap={{ reachPx }}>` overrides the setting
for one canvas. A candidate whose solution moves its probe further than its reach on screen is out.

The resolver combines in-reach candidates — up to `dim(H)` of them, each adding a constraint, all
within reach at the combined `δ` — and ranks the combinations by these keys, best first:

1. **Codimension within `H`.** A point beats a line, and a line beats nothing. Two lines through
   different probes combine, which is how x aligns to one shape while y aligns to another.
2. **Target-tier codimension.** A source is a `target` (default) or a `fallback`. The grid is a
   fallback with unlimited reach: it fills any axis no target claims and never displaces one.
3. **Screen displacement**, smaller first: the largest distance any member's probe moves from
   where `δ₀` put it. Distances within `1e-9` px count as equal.
4. **Order.** Candidates are numbered in source order, then in the order each source yields them,
   and the combination whose lowest numbers come first wins.

A candidate may be `required`: the result must meet one, whatever its reach (Shift's angle steps
are required). Each probe keeps its 24 nearest in-reach candidates, and every required one.

The marks drawn are those of every in-reach candidate the result meets, not only the winning
combination's: when three siblings share the edge you landed on, all three lines show.

`snap.suspend` (Ctrl) turns every source off for the frame; `H` still applies.

## Sources

| Source | Package | Tier | What it offers |
|---|---|---|---|
| `pathSnapSource(opts)` | core | target | path targets: anchors, box centers, crossings, tangent and perpendicular points from the gesture's `origin`, midpoints, extremes, quadrant points, the nearest point on a stroke; `only` and `kinds` pick them |
| `measureEndSource(opts)` | core | target | measurement ends |
| `rotationSnapSource()` | core | target | quarter turns and other nodes' angles, for a rotate |
| `gridSnapSource({ spacing, origin?, unitSystem? })` | guides | fallback | the grid line either side of each origin or pointer probe, on each axis |
| `guideSnapSource(getGuides)` | guides | target | ruler guides |
| `alignmentSnapSource(opts)` | guides | target | siblings' edges and centers, and an optional page box |
| `spacingSnapSource(opts)` | guides | target | positions that repeat a gap already between siblings, or center between two |
| `handleSnapSource(opts)` | path-tools | target | a control handle's angle steps and its partner's angle |
| `boxSnapSource`, `alignPlaneSource`, `groundGridSource` | kernel3d | target, target, fallback | 3D box corners, edges, faces and centers; planes through each box's min, center and max; the ground grid |

Every `<SceneCanvas>` asks two sources of its own: `rotationSnapSource()` (id `'rotation'`) and
`pathSnapSource({ only: ['anchor'] })` for point gestures (id `'path-snap'`). A source you register
with the same id replaces one; `snap={{ omit: ['rotation'] }}` drops one.

Sources reach a canvas three ways, asked in this order. Two of them sharing an id throw when a
gesture begins, since one would silently replace the other:

- `<SceneCanvas snap={{ sources }}>`;
- a feature preset's `snapSources` — `createSpacingHintsPreset` is alignment and spacing sources;
- `useSnapSource(source)` from a component under the canvas, while it is mounted.

`gestures` limits which gestures ask a source; the default is every gesture but `rotate` and
`handle`.

## Writing a source

A source names the probe roles it matches and yields candidates from `collect`, which runs once
per frame:

```ts
import type { SnapSource } from '@weasel-js/core';

/** A vertical line at x = 300 for origin and pointer probes, marked while met. */
const margin: SnapSource = {
  id: 'margin',
  roles: ['origin', 'pointer'],
  *collect(q) {
    for (const p of q.probes) {
      if (Math.abs(p.at.x - 300) > q.reachWorld(q.reachPx)) continue;
      yield {
        probe: p.id,
        locus: { at: { x: 300, y: p.at.y }, dirs: [{ x: 0, y: 1 }] },
        mark: { kind: 'line', from: { x: 300, y: 0 }, to: { x: 300, y: 1000 } },
      };
    }
  },
};

<SceneCanvas snap={{ sources: [margin] }} /* … */ />;
```

What `collect` is handed (`SnapCollect`):

| Field | |
|---|---|
| `gesture` | `'point'`, `'move'`, `'resize'` |
| `probes` | the probes of this source's roles, where `δ₀` puts them |
| `delta0` | the raw move |
| `box`, `edges` | the subject's drawn box at `δ₀` and the sides that move (move and resize) |
| `drawnBox(id)` | another node's box, measured the way `box` is |
| `exclude`, `include` | nodes that offer nothing (the subject and its subtree); nodes that alone offer targets |
| `origin` | where the geometry being drawn starts: a line's first end, the pen's previous anchor |
| `also` | geometry the gesture brings that is in no node: the still parts of a path being edited |
| `reachPx`, `reachWorld(px)` | the reach that applies to this source, and screen px as world units, to cull by |
| `scene` | the scene, absent in a host with none |
| `plane` | the parallax plane the probes are in; a target the camera draws (a grid, a guide) is carried into it |

Rules a source follows:

- **Cull by reach.** Yield only what could be in reach (`q.reachWorld(q.reachPx)`), so a scene
  with thousands of nodes does not hand the resolver thousands of candidates. The resolver drops
  anything out of reach anyway; culling is for cost.
- **Never assume an order.** A source does not know what else is registered and cannot win by
  running first.
- **Curves are re-solved each frame.** A target that depends on the probe (nearest on a stroke, a
  tangent) is emitted as a point locus for the probe's current position.
- **Marks are world coordinates.** A mark that depends on where the probe lands is a function of
  the resolved `δ`: `mark: (delta) => ({ kind: 'point', at: { x: p.at.x - q.delta0.x + delta.x, … }, glyph: 'center' })`.
- **Angle targets** come from `angles(q)` on a source whose `gestures` include `'rotate'` or
  `'handle'`, yielding `{ angle, required?, mark? }` in radians.

## The modifier roles

Every snapping action declares two roles in its `modifierRoles`, so a binding can remap them:

| Role | Default | Meaning |
|---|---|---|
| `snap.suspend` | Ctrl | no source answers; `H` still applies |
| `snap.constrain` | Shift | builds `H`: the angle step, the axis lock, the resize aspect lock |

A path-edit handle drag declares no `snap.suspend`: Ctrl already holds the handle's length there.
`snapMods(ctx)` reads both for an action of your own; `SNAP_ROLES` is the declaration to spread
into its `modifierRoles`.

## Writing an action that snaps

Begin at press, ask each frame, end on release:

```ts
const session = ctx.deps.snap?.begin({ gesture: 'point', press, origin: lineStart });
// each move (with no snap dep, the point stands as it is):
const point = session ? session.at(ctx.world, snapMods(ctx)).point : ctx.world;
// release or cancel:
session?.end();
```

`SnapBegin` also takes `ids` (the subject, which offers nothing), `handle` and `box` for a resize,
`pivot` and `theta0` for a rotate, `also`, and `constrain` (`{ step }`, `'axis'` or `'aspect'`),
which is what Shift turns into `H`. Declare `snap` in the action's `requires`. `pointSnap()`
wraps the cycle for a tool that places one point per click.

## The readout

Every `<SceneCanvas>` mounts one screen-space readout layer that draws the marks of the snap in
flight: point glyphs with labels, alignment lines, equal-gap marks, and distances. Sessions write
them to the canvas's outcome store, which the `snapReadout` dep also exposes, so the Alt-hover
`distanceReadout` writes its distances into the same store. A mark's `color` overrides the
readout's; `snap={{ readout: false }}` hides the layer and `readoutStyle` sets its defaults.

The debug overlay's `snap` feature (`?debug=snap`) draws every candidate the resolver weighed in
the last frame, filled where the result met it.

## 3D

The resolver is written over n-vectors, so a 3D host uses the same sources, ranking and marks with
`Vec3` points. kernel3d's `createSnap(world, { sources, reachPx, kitSettings, store })` is its
`snap` dep, reading its reach from `targets.snapPx` in `kitSettings`. Two sources sharing an id
throw, as on a canvas:

- A move's `H` is the plane through the subject perpendicular to `up`, the plane `translate`
  already moves on; an insert snaps the pointer on the ground plane.
- The session still answers in ctx coordinates, which in a 3D host are screen points: it projects
  the snapped world position back, and `translate` and `createInsert` cast it onto the same plane,
  so the round trip is exact and `InvocationCtx` stays 2D.
- `boxSnapSource`, `alignPlaneSource` and `groundGridSource` are its sources, and
  `projectSnapMarks(marks, viewport)` turns the store's `Vec3` marks into screen lines and points
  for the host to draw.

A host with neither `<SceneCanvas>` nor kernel3d builds its session from `gatherSnapCandidates`
(asks the sources) and `resolvedSnapMarks` (the marks of what the result met) around
`resolveSnap`.

## Decisions

Calls made in the design, kept so they are not re-argued by accident:

- The resolver lives in geom, pure and dimension-free; each source lives with the package that
  owns its geometry (2026-10-17).
- Points beat lines through codimension, and per-axis alignment falls out of combining lines (2026-10-17).
- The grid is a fallback, so alignment beats the grid on an axis instead of adding to it (2026-10-17).
- One reach setting, `targets.snapPx`, default 8, with a per-source override (2026-10-17).
- `snap.suspend` is Ctrl everywhere except path-edit handle drags; Alt keeps its own meanings
  (clone, insert from center, breaking a handle's mirror) (2026-10-17).
- Probes keep what each source snapped before the pipeline: the origin for the grid and guides,
  the drawn box for alignment and spacing (2026-10-17). Whether the grid and guides should snap the stroke's edge
  is open (`docs/TODO.md`); either answer is a change to those two sources' `roles`.
- Handle snapping stays angular: a one-dimensional angle about the anchor, keeping the length (2026-10-17).
- A move gains Shift axis lock, and a rotate gains quarter-turn and sibling-angle targets without
  Shift (2026-10-17).
- Every canvas snaps point gestures to other nodes' anchors by default; the other path kinds are
  opt-in through `pathSnapSource()` (2026-10-18).
- Container slots and layout drops are not snapping: they decide which parent a node joins, and
  stay move behaviors (2026-10-17), running after the snap on the snapped delta (2026-10-18).
- Old snap APIs were removed, not wrapped (2026-10-17).
- The symmetry axis turns through a `rotate` session about its center, so it meets quarter turns
  and other nodes' angles without Shift and draws the angle readout (2026-10-18).
