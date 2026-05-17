# Simulation primitive — design

**Status:** draft → implementation
**Date:** 2026-05-16
**Predecessor:** none (new feature)

## Motivation

The kit has good interpolation primitives (`useAnimator` for tweens / springs / decay) but no support for **continuous N-body physics** — force-directed graphs, particle systems, "loose" arrangements with collision avoidance. Real users want this; d3-force is the canonical library for it.

Rather than ship a thin "d3-force plugin," we factor out the part that's *generally* useful (the tick loop + integrator + alpha cooling) into a kit-owned primitive whose force protocol is **contract-compatible with d3-force**. Consumers who want d3's forces import them from `d3-force` and pass them to `useSimulation`. Consumers who want custom forces write a function matching the same protocol. The kit owns the loop; the force library is pluggable.

This mirrors the architectural pattern established by `useAnimator` (kit-owned loop, pluggable easings / interpolators).

## Scope (v1)

**In scope:**
- `useSimulation<TNode>(opts): Simulation<TNode>` hook
- Tick loop with velocity-Verlet integration, alpha cooling, settle detection
- d3-force-compatible force protocol (`(alpha) => void` + `initialize?(nodes)`)
- d3-force-style getter/setter API on the handle
- Manual stepping (`tick(n)`) for offscreen pre-warm and tests
- StrictMode-safe cleanup (mirror `useAnimator`)
- One demo: force-directed graph using d3-force, drag-to-pin, settle commit

**Out of scope (v1):**
- Built-in forces. Consumers bring d3-force or write their own.
- Drag-to-pin helper hook. Demo wires it manually in ~10 lines. Helper considered for v2 after demos shake out.
- Sugar wrappers like `useSimpleSimulation(adapter, ids)` that hide the node array. Considered for v2.
- Worker / OffscreenCanvas offload. Future spec.
- 3D physics, constraint-based simulation, pose-shaped integration (rotation, scale). Possible extensions; not blocked by v1 shape.
- Sharing the tick loop with `useAnimator`. Each has its own RAF. Possible extraction later if a hot path emerges.

## Architecture

### Module placement

`src/features/simulation/` per the kit's feature taxonomy. Files:

- `index.ts` — barrel
- `types.ts` — `SimulationNode`, `SimulationForce`, `UseSimulationOptions`, `Simulation`
- `useSimulation.ts` — hook implementation
- `useSimulation.test.ts` — unit + lifecycle tests

Re-exported from the kit's main barrel (`src/index.ts`).

### Relationship to `useAnimator`

Independent. `useAnimator` drives interpolations between known states; `useSimulation` drives continuous physics with no known end state until settle. They share no code in v1 and can coexist on the same scene.

### RAF loop

Own `requestAnimationFrame` loop, scoped to the hook instance. Pattern mirrors `useAnimator` for StrictMode-safe mount/unmount and "fired after unmount" tripwire.

## Public API

### Types

```ts
interface SimulationNode {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  index?: number;
}

interface SimulationForce<TNode extends SimulationNode = SimulationNode> {
  (alpha: number): void;
  initialize?(nodes: TNode[], random?: () => number): void;
}

interface UseSimulationOptions<TNode extends SimulationNode> {
  nodes: TNode[];
  forces?: SimulationForce<TNode>[];

  alpha?: number;          // initial; default 1
  alphaMin?: number;       // settle threshold; default 0.001
  alphaDecay?: number;     // per-tick decay; default 1 - 0.001^(1/300)
  alphaTarget?: number;    // target alpha; default 0
  velocityDecay?: number;  // velocity friction multiplier per tick; default 0.4

  onTick?: (nodes: TNode[]) => void;
  onEnd?: () => void;
}

interface Simulation<TNode extends SimulationNode> {
  readonly nodes: TNode[];

  setNodes(nodes: TNode[]): this;
  setForces(forces: SimulationForce<TNode>[]): this;

  alpha(): number;          alpha(value: number): this;
  alphaTarget(): number;    alphaTarget(value: number): this;
  alphaDecay(): number;     alphaDecay(value: number): this;
  alphaMin(): number;       alphaMin(value: number): this;
  velocityDecay(): number;  velocityDecay(value: number): this;

  restart(): this;
  stop(): this;
  tick(iterations?: number): this;

  isSettled(): boolean;
}
```

### Hook signature

```ts
function useSimulation<TNode extends SimulationNode>(
  opts: UseSimulationOptions<TNode>
): Simulation<TNode>;
```

### Why d3-style getter/setter overloads

`simulation.alphaTarget(0.3).restart()` works the same as in raw d3-force. d3 users lift existing code without translation. Cost of the overload pattern is small; cost of forcing translation is real.

## Tick semantics

Each frame, the loop runs **one tick**, in this order:

1. **Decay alpha:** `alpha += (alphaTarget - alpha) * alphaDecay`
2. **Apply forces:** `for (const f of forces) f(alpha)` — each force mutates `node.vx` and `node.vy`.
3. **Integrate per node:**
   - If `fx != null`: `node.x = fx`, `node.vx = 0`.
   - Else: `node.vx *= (1 - velocityDecay)`; `node.x += node.vx`.
   - Same for `y` / `vy` / `fy`.
4. **Fire `onTick(nodes)`.**
5. **Settle check:** if `alpha < alphaMin && alphaTarget === 0`, fire `onEnd()` once, stop the RAF loop. Sim can be revived later by `restart()` or by setting `alphaTarget > 0` plus `restart()`.

### `restart()` behavior

Resumes the RAF loop. If `alpha < alphaMin`, reset `alpha = 1` (mirrors d3-force `simulation.restart()` exactly). If RAF loop is already running, no-op.

### `stop()` behavior

Cancels the RAF loop without changing alpha. Idempotent. `restart()` resumes.

### `tick(iterations = 1)` behavior

Runs the tick body synchronously `iterations` times. Does *not* fire `onTick` / `onEnd` (matches d3-force). Used for offscreen pre-warm ("converge before showing") and tests.

### `setNodes(newNodes)` / `setForces(newForces)`

Swap the respective array. Call `force.initialize?.(currentNodes, random)` for each affected force. Does not reset alpha — consumer decides whether to call `alpha(1).restart()` to re-energize.

### Force `initialize`

Called on:
- Hook mount, for each force.
- `setNodes()`, for all forces.
- `setForces()`, for each new force.

d3-force forces use `initialize` to compute indices, link references, etc. Required for `forceLink` to work.

### `random` argument

Defaults to `Math.random`. (Possible future extension: seedable RNG for reproducible layouts. Out of v1 scope.)

## Consumer integration pattern

A force-directed graph demo wires this as follows (illustrative, not normative):

```ts
import { forceManyBody, forceLink, forceCollide, forceCenter } from 'd3-force';

interface GraphNode extends SimulationNode {
  id: string;
}

const nodes = useMemo<GraphNode[]>(
  () => initialNodes.map(n => ({ id: n.id, x: n.x, y: n.y })),
  []
);
const linksRef = useRef(initialLinks);

const sim = useSimulation<GraphNode>({
  nodes,
  forces: [
    forceManyBody().strength(-30),
    forceLink(linksRef.current).id(n => n.id).distance(50),
    forceCollide(12),
    forceCenter(width / 2, height / 2),
  ],
  onTick: () => {
    // Bypass undo per tick. Adapter's direct-write path or a sim-mode flag.
    for (const n of nodes) adapter.setPoseDirect(n.id, { x: n.x, y: n.y });
  },
  onEnd: () => {
    // One undoable batch capturing the settled layout.
    adapter.applyBatch(nodes.map(n => createSetPoseOp(n.id, currentPoseOf(n))));
  },
});

// Drag-to-pin:
const onPointerDown = (id) => {
  const n = nodes.find(n => n.id === id)!;
  n.fx = n.x; n.fy = n.y;
  sim.alphaTarget(0.3).restart();
};
const onPointerUp = (id) => {
  const n = nodes.find(n => n.id === id)!;
  n.fx = null; n.fy = null;
  sim.alphaTarget(0);
};
```

**Per-tick history bypass** is consumer-side. The kit has no opinion. If the consumer's adapter doesn't expose a direct-write path, they're free to add one or to use a wrapper like the existing `animateOnSetPose` pattern.

**Settle commit** is consumer-side. The kit fires `onEnd`; the consumer builds and pushes whatever batch they want.

## StrictMode-safe cleanup

Mirror `useAnimator`'s pattern (see `src/animation/useAnimator.ts`):

- `mountedRef` flips false on unmount.
- A tripwire flag detects ticks fired after unmount (regression catcher).
- The RAF handle cancels in the unmount effect.
- Re-entry from the StrictMode double-mount creates a fresh sim; the first mount's RAF is cancelled cleanly.

## Testing

Tests live in `src/features/simulation/useSimulation.test.ts`. Unit-level coverage:

- **Alpha decay math.** Starting alpha 1, alphaDecay default, settles in ~300 ticks.
- **alphaTarget keeps sim warm.** alphaTarget > 0 → alpha never drops below alphaTarget → onEnd never fires.
- **Velocity integration.** Constant nonzero force → linear position drift per tick; velocityDecay correctly damps over time.
- **fx/fy pinning.** Setting fx pins x and zeroes vx; clearing fx releases.
- **Force protocol.** `initialize` called on mount, on setNodes, on setForces (new forces only). Force called with current alpha each tick.
- **Lifecycle controls.** `restart()` from settled state resets alpha; `stop()` pauses RAF; `tick(n)` runs n steps synchronously without firing onTick/onEnd.
- **isSettled().** Reflects alpha < alphaMin && alphaTarget === 0.
- **StrictMode cleanup.** Double-mount doesn't leak a second RAF loop; tripwire stays clean.

Integration / smoke:

- **Demo smoke test.** Demo component renders, sim ticks, onTick writes scene, settle fires once. (Manual visual verification in browser.)

## Demo

`demo/demos/ForceGraphDemo.tsx` with hash `#force-graph`:

- 20-30 nodes, ~30 edges, random initial positions
- `d3-force` forces: manyBody, link, collide, center
- Drag-to-pin wired manually
- "Reset" button calls `sim.alpha(1).restart()`
- Settles within ~5 seconds at default alphaDecay

Adds `d3-force` to the demo workspace's devDependencies (not the kit's).

## Public exports

From `src/features/simulation/index.ts`, re-exported via `src/index.ts`:

```ts
export { useSimulation } from './useSimulation';
export type {
  Simulation,
  SimulationNode,
  SimulationForce,
  UseSimulationOptions,
} from './types';
```

## Open follow-ups (post-v1)

- **Drag-to-pin helper hook.** After 2-3 demos demonstrate the same boilerplate, extract `useDragPin(sim, nodes, adapter)`.
- **Sugar wrapper.** `useSimpleSimulation(adapter, ids, forces)` that internally builds the d3-shaped array and writes back. Pure ergonomics over `useSimulation`.
- **History-bypass adapter wrapper.** If multiple consumers wire the same "bypass during sim ticks" pattern, extract analogously to `animateOnSetPose`.
- **Worker offload mode.** Separate API; bifurcated from v1 (mutable JS array doesn't transfer cleanly).
- **Seedable RNG.** Pass-through to forces' `initialize(nodes, random)`.
- **Shared tick loop with `useAnimator`.** Only if a perf hotspot emerges. Refactor risk; not free.
- **Built-in forces.** Center, collide-by-radius, x/y target, drag-friction. Lets consumers skip d3-force for simple cases. Each is a small file; ship as consumers ask.
- **Rotation / scale integration.** Extend `SimulationNode` with `rot`, `vrot`, etc. Consumer-side custom forces would target these fields.
