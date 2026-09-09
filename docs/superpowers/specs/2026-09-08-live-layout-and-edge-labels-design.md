# Live layout and edge labels

**Unbuilt as of 2026-09-08.** Two arcs on top of `@weasel-js/diagram` 1.4.3 and
the derived-geometry seam in core. Arc 1 finishes the last piece of
`2026-08-28-diagram-plugin-design.md`; arc 2 turns layout from something that
teleports into something you watch and push against.

For whoever implements it. Assumes the derived-geometry vocabulary — `dependsOn`,
`derivePath`, `derivePose`, `effectivePose` — which `docs/extending.md` defines.

## Arc 1: a dependency carries its resolved path

A derivation is handed its dependencies' nodes and poses. It is not handed their
derived *paths*, so nothing can be positioned along a route: an edge label is a
node with `dependsOn: [edge]` that has no way to read where the edge went.

**`DerivedDep` becomes `{ node, pose, path }`.** `path` is the dependency's
resolved derived path, or `null` when it derives none. It resolves on first read
and memoizes, so a route is computed once per frame whether one node reads it or
five, and a dependency nobody asks about costs nothing.

Both dep-carrying seams get it. `derivePath` deps come from `sceneDepLookup`;
`derivePose` deps are built inside `derivedPose`. A label derives its *pose* from
the edge's path, so `effectivePose` has to reach path resolution — which today
lives in `canvas/derivedPath.ts`, above the scene. **Move
`resolveDerivedPath` into `core/scene/` beside `derivedPose`**, and leave
`canvas/derivedPath.ts` holding `withDerivedPaths`, the render-walk wrapper,
which is what it is for.

`resolveDerivedPath` picks up the cycle guard `derivedPose` already has: a
`resolving` set, a fallback of `null` at whichever node closes the cycle, and a
memo drop for any value computed while the guard fired. A path derivation can
now reach another path derivation, so a cycle stops being unreachable.

### The label

An ordinary leaf node with `dependsOn: [edge]` and a registered `derivePose`,
under a registry key so it round-trips through `toJSON` the way `EDGE_DERIVE_PATH`
does. Its trait sits on `data.diagram`, alongside the node and edge traits:

```ts
interface DiagramLabel {
  /** Where along the route: 'start' | 'mid' | 'end', or 0..1. */
  at: 'start' | 'mid' | 'end' | number;
  /** Perpendicular to the route at that point, in world units. Default 0. */
  offset?: number;
}
```

`diagramEdgeOf` tests for `from` and `to`, so a label trait is never read as an
edge. The derivation walks the dependency's path to the parameter, takes the
tangent there for the offset's direction, and returns a pose centered on the
result — the label keeps its own size, and only its position derives.

A label whose dependency has no path (the edge was deleted, or never derived
one) derives nothing and falls back to its authored pose, which is the rule
`derivePose` already follows.

## Arc 2: live layout

Today a layout is one press: `createLayoutAction` rebuilds the graph, runs the
algorithm, and writes every move in one batch. The nodes jump. A force
relaxation in particular is a process worth watching, and worth pushing a node
around inside.

### The transport, in core

**A pose run publishes to the override channel each frame and commits once.**
The channel is `scene.overrides` — the same ephemeral table a drag publishes to,
which `effectivePose`, `sceneDepLookup` and the pick source already read. So an
edge follows a relaxing node with nothing added, and a whole run lands as one
undo entry.

Not the animator: `tweenPose` records a transform op per node and writes the
document every frame, so one layout arrives as N undo entries.

Working name `usePoseRun` (alternates: `useLivePoses`, `usePoseLoop`). It knows
nothing about layout:

```ts
const run = usePoseRun<TPose>({
  scene,
  /** Called once per frame. `pinned` names the nodes another gesture owns and
   *  the pose each is currently drawn at. */
  step: (ctx: { pinned: ReadonlyMap<NodeId, TPose> }) => {
    poses: Iterable<[NodeId, TPose]>;
    done: boolean;
  },
  /** The undo entry's name. Default 'Layout'. */
  label?: string;
});
run.start();    // idempotent
run.stop();     // commit what is published, then drop the overrides
run.cancel();   // drop the overrides, write nothing
run.isRunning();
```

The loop runs behind `useVisibleRaf`, so a diagram nobody is looking at stops
relaxing and picks up where it left off. Its step is frame-counted, not
time-based, so there is no clock to rebase on resume.

**Committing** is one `scene.batch` of `setPose` for every id the run published,
fired when `step` reports `done` or when the consumer calls `stop`. Cancel drops
the overrides and the document is untouched, exactly like a canceled drag.
Unmount cancels rather than commits — teardown is not a decision.

**Pinning falls out of the channel.** `syncPreviewOverrides` already holds each
published entry by reference so a frame can mutate it in place; the run holds
its own entries the same way. A node carrying an override the run did not
publish belongs to somebody else, so the run never writes that id and reports it
to `step` as pinned. The consumer's existing move tool therefore drags a body
mid-relaxation with no diagram-specific gesture, and resize or a group drag pin
the same way for free. The run commits only ids it published, so it never
re-commits a node the mover already wrote.

`syncPreviewOverrides` stays internal to core; the run imports it rather than
reimplementing the entry-identity trick, and nothing new becomes public.

### The producers, in diagram

**`force` ticks.** One simulation tick per frame, pinned nodes' `fx`/`fy` set
from the poses `step` was handed, done when alpha falls below its minimum. The
live producer and the one-shot `force()` build their bodies and forces from one
factory — two copies of the force list drift, and the arrangement they produce
is the only thing that would say so.

**`layered` and `tree` ease.** The target is a `LayoutResult` computed once;
each frame interpolates current→target with a core easing and is done at `t = 1`.
Re-running the layout mid-ease recomputes the target and keeps going.

Both reach the scene the same way `applyLayout` does — poses are **translated**
through the pose descriptor, never rebuilt from the layout's numbers, and a
participant that is a container takes its subtree along. That walk exists in
`applyLayout` and is shared, not copied.

**Re-heat** happens on three things: a pinned node moving (alpha target rises
while a pin exists and returns to zero when it goes), the graph's node or edge
set changing, and an explicit `restart()`. A resize does not re-heat.

`useLiveLayout({ source, algorithm, ... })` is the diagram-level hook, and
`createLiveLayoutAction` the toggle for an action bar — the same factory shape
as `createLayoutAction`, for the same reason: which nodes are in the diagram is
the consumer's, and this package has no scene at module scope.

## Demos

`#diagram-layout` keeps its three one-shot buttons — it is about what the three
algorithms do.

`#diagram-live` is new: one graph, relaxing, where dragging a box makes the rest
answer. It is the demo for the transport and for pinning through the ordinary
move tool.

Labels go into `#diagram-edges`, where routes already live.

## Testing

The run takes an injected clock the way `useSimulation` does, so jsdom steps it
frame by frame: overrides published per frame, one batch at `done`, nothing at
`cancel`, a foreign override skipped and reported as pinned.

**jsdom cannot show that a pin holds** — nothing there drags. The assertion is
on this side of the boundary: `step` is handed the pinned id and pose, and the
run publishes no override for it. Say in the test that this is a proxy for the
browser behavior, not the behavior.

For force, the guard against the two force lists drifting is that N live frames
and a one-shot run of N ticks produce the same arrangement.

For labels: a route is resolved once per frame however many labels read it
(count router calls), a label moves when its edge's endpoint moves, and a cycle
resolves rather than overflowing.

## Arc order

Arc 1 lands and goes green alone. It is a core seam on the hot render path and
it moves a module between layers; nothing frame-shaped should be built next to
it until it is proven. Arc 2 follows and touches none of it.

## Open questions

**Does a run that is still going when the page is hidden hold its overrides
indefinitely?** `useVisibleRaf` stops the loop, the published poses stay, and
nothing is committed until someone comes back. Acceptable, but it means a tab
closed mid-relaxation loses the arrangement. Decide whether hiding commits.

**What re-reads the graph mid-run.** The producer rebuilds the `Graph` on
re-heat; whether it also rebuilds on every frame is the same "does `Graph` need
incremental maintenance" question the diagram spec left open. Rebuild on re-heat
until measurement says otherwise.
