# weaselchart: grid, snapping and preferences

Design for giving weaselchart (`apps/chart`) a page grid, snapping to that grid and to other shapes,
and a persisted preferences schema, and for moving `@weasel-js/diagram`'s route-handle snapping onto
core's snap pipeline so the grid reaches connector routes too. For the builder who will plan and
implement it; assumes familiarity with `docs/snapping.md`.

**Status: unbuilt (2026-10-19).**

## Why

Chart mode lays out flowcharts on a page, and today nothing snaps: `ChartWorkspace` passes no snap
sources and the `draw` preset adds none, so shapes land wherever the pointer lets go. Route handles
do snap, but through diagram's private `routeSnap.ts`, which no canvas source can join. Chart also
has no preferences at all; pipeline mode's Look is a `useState` that resets on reload.

## Goals

- A grid drawn on the page in chart mode, toggled from View › Show grid.
- Snap to grid (View › Snap to grid) for every gesture that snaps: move, resize, insert, and route
  handles.
- Alignment and equal-spacing snaps to other shapes, from guides' `createSpacingHintsPreset` with
  `align` on, toggled by a preference.
- A chart preferences schema, persisted to localStorage, with a Preferences dialog.
- Route-handle drags resolved by core's snap session, so the grid, Ctrl-suspend and Shift axis lock
  apply to them like any other gesture.

## Non-goals

- Grid or snapping in pipeline mode: its looks lay themselves out (decided 2026-10-19). Its Look
  does move into the preferences schema.
- Connector endpoint targeting (`connectorTool`, `reconnect`, `connectTargets`). Choosing which port
  an end attaches to is connection, not snapping, and stays as it is.
- Ruler guides.

## Decisions (2026-10-19)

- Route handles snap through core, not through a grid option added to `routeSnap` — one snap
  system.
- Alignment and spacing come along with the grid, each on by default.
- Chart mode only.
- Pipeline mode's route editing takes the engine change too — readout-colored guides, Shift axis
  lock, Ctrl suspend — since its node-graph Look drives the same action; no opt-out.

## The engine change: route handles on core's snap session

`createRouteEditAction` (`packages/diagram/src/waypointAction.ts`) computes each frame with
`snapPoint` against two kinds of target: the neighboring stops (both axes) and each end's port axis
(`portTarget`: one axis for a port with a normal). It draws its own guides as `overlay()` polylines.

After the change:

- The action begins a `'point'` snap session at press (`ctx.deps.snap?.begin`), asks it each move,
  and ends it on release or cancel. With no `snap` dep it behaves as unsnapped. It declares
  `SNAP_ROLES` in its `modifierRoles` and `snap` in `requires`.
- **The gesture brings its own targets.** The neighbor stops and port axes exist only for this
  drag, so they cannot be a canvas source. Core gains `SnapBegin.sources?: readonly SnapSource[]`:
  sources the session asks for this gesture alone, after the canvas's, ranked under the same rule.
  diagram builds one per drag, a `target` tier source with `roles: ['pointer']`, yielding a line
  locus through each neighbor stop on each axis and through each port along its axis. Its reach is
  the action's existing `snapPx` option (default 6) as `reachPx`.
- **A segment drag moves along one axis whatever the modifiers.** No new field: `inputFlat` already
  turns a `handle` with exactly one `free` axis into a fixed line, whatever the gesture, and route
  segments are always horizontal or vertical, so a segment drag passes `handle` (builder's call).
  `inputSession` is not public, so with no `snap` dep the action holds the axis itself.
- **A vertex drag passes `constrain: 'axis'`**, so Shift locks it to 45° steps like a move
  (builder's call — nothing forces it).
- **One gesture can leave out a canvas source.** Core gains `SnapBegin.omit?: readonly string[]`,
  the per-gesture twin of `snap.omit`. The route action omits `'path-snap'`: a bend snapping to
  shapes' corner anchors is noise, and alignment already offers their edges (builder's call). It
  passes `ids: [edgeId]` so the edited edge offers nothing.
- **The new `SnapBegin` fields work in kernel3d's `SnapDep` too** (`packages/kernel3d/src/deps.ts`),
  since a core pipeline is designed for a 3D host (builder's call).
- The per-drag source states `gestures: ['point']` and takes an id that cannot collide with a
  canvas source, since `assertSnapSourceIds` throws on a shared one.
- **Marks move to the readout.** Each candidate carries a `line` mark from its target point to the
  snapped probe (a function of `δ`), replacing the `overlay()` guides. The guide color therefore
  becomes the readout's.
- `snapPoint`, `portTarget` and `stopTarget` are deleted once nothing uses them, not kept beside the
  new source.

Ranking then gives the intended result with no special cases: a neighbor or port alignment within
reach claims its axis, and the grid — a fallback with unlimited reach — fills the other. With
alignment on, `alignmentSnapSource` (roles `box` and `pointer`) also lines a bend up with the
bodies' edges and centers, which is wanted (builder's call).

docs/snapping.md gets the two `SnapBegin` fields, and route handles in its "Gestures that snap"
list.

## Chart: preferences

`apps/chart/src/prefs.ts`, modeled on `apps/draw/src/prefs.ts` but without its legacy import and
migrations: a `CHART_PREFS` schema, `openPrefsSync` over `localStorageAdapter` with its own prefix,
a lazily opened store, and a typed `usePref`.

| Path | Kind | Default |
|---|---|---|
| `view.gridVisible` | boolean | `false` |
| `view.gridSpacing` | number, slider | 12 (⅛ in at chart's 96 per inch); min 4, max 96, step 4 |
| `view.snapToGrid` | boolean | `false` |
| `view.alignmentSnap` | boolean | `true` — edges and centers of other shapes |
| `view.spacingSnap` | boolean | `true` — equal gaps between shapes, and the Alt-hover distance |
| `pipeline.look` | enum of `EditorLook` | `'nodeGraph'` |

`App` reads `pipeline.look` from prefs in place of its `useState`.

A Preferences… item opens ui's `PrefsDialog` over the store. It sits in the View menu in both
modes, since the store covers both.

## Chart: grid and snapping

- **One grid hook for both apps.** `apps/draw/src/useGrid.ts` builds the layer and snap source from
  draw's prefs. Its value-driven half — page bounds, spacing, background color, accent period in,
  `{ layer, source }` out — moves to `@editor` (`apps/shared/editor`) as a hook both apps call; each
  app keeps the part that reads its own prefs.
- The grid draws on the page only, beneath the scene and above the paper, with a heavier line every
  8th (every inch at the default pitch).
- `ChartWorkspace` passes `snap={{ sources }}` holding the grid source while `view.snapToGrid` is on,
  and the alignment and spacing sources while their prefs are on — from `createSpacingHintsPreset`
  if it can express each alone, else `alignmentSnapSource` and `spacingSnapSource` directly. All of
  it stays stable by identity, since `SceneCanvas` keys its wiring off it.
- **Only bodies are alignment and spacing targets.** Connectors are top-level siblings of the
  bodies, so by default a moved body would line up with an edge's bounding box. Chart passes
  `getCandidates` (or the equivalent) limiting targets to bodies.
- **A stencil dropped from the Shapes panel lands where a move would.** `stencilDropHandler`
  centers the new body on the drop point and snaps nothing; under snap to grid its origin should
  sit on the grid, as one dragged there would. How it reaches the snap session is the builder's.
- **View menu in chart mode:** Show grid and Snap to grid as toggles that read as held while on,
  and Preferences…. Pipeline mode's View menu keeps its Look items and gains Preferences….

## Testing

- Core: a gesture-local source is asked and ranked with the canvas's, in 2D and in kernel3d;
  `omit` drops a canvas source for that gesture only.
- diagram: the route action snaps a vertex to a neighbor on one axis and to the grid on the other; a
  segment drag stays on its axis; Ctrl suspends; marks reach the readout store.
- Chart: prefs round-trip through storage; the View toggles flip the prefs; a moved shape and a
  dropped stencil land on the grid with snap on. The grid's look gets a screenshot check in a
  `*.browser.test.tsx`.

## Left to the builder

The names of the two `SnapBegin` fields (`sources`, `omit`); the shared grid hook's exact signature; how a drop reaches the snap session; menu item labels beyond those named.
