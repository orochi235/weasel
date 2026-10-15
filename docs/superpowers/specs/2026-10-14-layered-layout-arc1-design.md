# Layered layout, arc 1: ranks, placeholders, ordering, placement

**Status: being built on branch `worktree-layered-layout`. Delete this file when the branch merges.**

For whoever builds or reviews `@weasel-js/diagram`'s `layered` layout. It says what arc 1
changes and the rules each step keeps. Arcs 2 (ports in the layout graph, ports that choose
their side) and 3 (labels kept clear of boxes and wires) get their own specs later.
Background on the standard method: https://claude.ai/artifact/VQsHL8ooYGrPvaXUkHtRpc

## Why

`layered` lets wires run through boxes and cross one another (`docs/TODO.md`, the P2 entry
"`layered` lets wires, boxes and labels overlap"). On the EffectChart demo pipeline it puts
every input in the first column, gives a wire that skips columns no room in the columns it
crosses, and packs each column without regard to the wires.

## Two modes, unchanged

- **Order-finding** (`order: 'barycenter'`, which `diagramScene` defaults to): reorders each
  rank to cut crossings. A small change to the data may rearrange the chart.
- **Editing** (`order: 'seeded'`, the default, used on a live scene by `layoutAction`): keeps
  the order nodes already sit in.

Both keep the `LayoutFn` contract: synchronous, pure, returns only nodes that move, pinned
nodes never move and the layout translates around the first pin, no randomness, ties broken
by graph order, and a second run returns nothing.

## The steps

Each step is a pure function in its own file under `packages/diagram/src/layered/`.

| Step | Rule |
|---|---|
| Break cycles | `backEdges` (unchanged): a depth-first walk in graph order. Its edges are turned around for every later step, so they get ranks, placeholders and routes. |
| Rank | Network simplex, minimizing total edge length (rank difference, at least 1), every edge weighing 1, over the edges `expandGroupEdges` produces. Starts from the longest-path ranking, which is already valid; stops after a bounded number of rounds and returns the best valid ranking so far. Ranks are normalized to start at 0. Ties: graph order. |
| Placeholders | Order-finding mode only. A wire spanning ranks gets one placeholder node per rank strictly between its ends; for a wire to or from a group, strictly between the group's rank span and the other end. A placeholder's extent across the rank is half the node gap and along the rank zero. It belongs to a group only when both ends of its wire are inside that group. |
| Order | Seeded from current cross positions, as today. Order-finding mode then runs barycenter sweeps over the graph with placeholders, plus transposition (swap neighbors in a rank when that lowers the crossings between it and its neighbor ranks), keeps the order with the fewest crossings, and stops after a fixed number of sweeps without improvement. Within a rank, a group's members (and its placeholders) stay contiguous, and a nested group stays contiguous inside its parent: a group sorts as one block, keyed by the mean of its members' keys. Editing mode keeps the seeded order. |
| Place | Brandes–Köpf (four alignments, balanced), separating neighbors by their extents across the rank plus the node gap. With groups, its result is the `preferred` position `packClusters` already takes, so group columns hold. Nodes stay centered in their rank's band, and rank gaps come from `rankGaps` as today. |
| Plan | Maps placements to world coordinates with `settle`'s rules, applying the same translation to placeholders. Each placeholder gives two waypoints, where its wire enters and leaves the rank's band. |

## Surface

- `layered: LayoutFn`: unchanged signature; returns the plan's moves.
- `layeredPlan(graph, opts) => LayeredPlan`, new: `{ moves: LayoutResult; ranks: ReadonlyMap<string, number>; back: ReadonlySet<string>; waypoints: ReadonlyMap<string, readonly Vec2[]> }`, waypoints keyed by the graph edge's id (the scene edge id, before any `#k` suffix from group expansion).
- `ranksByLength(graph, back) => Map<string, number>`, new: the network-simplex ranking.
- `ranksOf` and `backEdges`: unchanged (`chain` uses `ranksOf`).
- `layeredRoutes` keeps choosing compass faces and takes ranks and waypoints from the plan rather than ranking again and searching for gaps. A turned-around edge leaves by the face toward the previous rank and arrives by the face toward the next. An author's own ports and waypoints still win (`authoredOver`).
- `diagramScene` calls `layeredPlan` once and passes its waypoints to `edgeSpecs`.

## Not in arc 1

- Editing mode adds no placeholders: their seed order would come from wire ends that layout
  moves, so two could swap between runs and break "a second run moves nothing". It writes no
  waypoints either, since a scene's waypoints belong to whoever drew them. Filed in
  `docs/TODO.md`.
- `tree`: its edges join adjacent ranks and cannot cross a box.
- Ports and labels: arcs 2 and 3.

## Tests

- Per step: the ranking reaches the known minimum total length (9 on the EffectChart demo
  pipeline, against 14 for longest path); after cycle breaking every edge points forward; one
  placeholder per skipped rank; ordering never ends with more crossings than its seed; placement
  keeps each rank's order and gaps and lines a straight run up exactly.
- Generated graphs from a fixed-seed generator inside the test, both modes: no two nodes in a
  rank overlap, no outsider enters a group's column, pins hold, same input gives same output, a
  second run moves nothing.
- Through `diagramScene`, on the EffectChart demo pipeline, every `effect/lab/samples.ts`
  sample, and a fixture shaped like blits' `anchors` preset: no routed wire passes through a box
  it does not connect to, and crossings do not exceed the count recorded before this work.
- Screenshots of both EffectChart demos and the layout demo, before and after, on the wall.
