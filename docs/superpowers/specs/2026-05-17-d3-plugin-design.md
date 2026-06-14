# d3 plugin — design

**Status:** draft → implementation (3 landings)
**Date:** 2026-05-17
**Predecessors:** `2026-05-16-simulation-primitive-design.md` (kit-owned simulation primitive; d3-force already integrates via `useSimulation`)

## Motivation

`useSimulation` brought d3-force into the kit by exposing a force protocol contract-compatible with `d3-force` — kit owns the loop, d3 (or anyone) owns the per-step force computation. This spec extends that pattern to the rest of d3's load-bearing surface:

- **Data-join** (`d3-selection`'s `.data(data, key).join(...)` idiom) — the canonical way d3 reconciles arrays of data with scene state. Lifts directly to weasel's op model: enter → InsertOp, update → SetPoseOp, exit → DeleteOp.
- **Transitions** (`d3-transition`'s `.transition().duration().ease()...` chain) — bridges to the kit's `useAnimator`. d3's per-tick interpolation gives us color/path/string/object tweens for free, which the kit's animator doesn't have natively today.

Both pieces land as a **separate package**, `@weasel-js/d3`, with `d3-force`, `d3-interpolate`, and (optionally) `d3-ease` as runtime deps. Consumers who don't want d3 don't pay the bundle cost.

One kit-side change unblocks the plugin and benefits non-d3 consumers: the animator gains a pluggable interpolator slot so `tween` can accept `d3-interpolate` (or any equivalent) for non-numeric values.

## Scope (v1 across all 3 landings)

**In scope:**
- Animator interpolator slot — `tween({ interpolate?: (a, b) => (t) => v })`. Default stays the numeric lerp.
- `d3Bind(scene, data, { key })` returning a chainable selection.
- `.pose(fn)` / `.data(fn)` declarative setters.
- `.join()` and `.join({ enter, update, exit })` — emits one batched op group, returns merged selection.
- `.transition().duration().ease().delay().end().interrupt()` chain over `useAnimator`.
- `.tween({ name, from, to, interpolate?, apply })` escape hatch for non-pose values.
- Lifecycle hooks: `.on('start' | 'end' | 'interrupt', fn)`.
- One PoC demo (Les Misérables co-occurrence network or equivalent) using d3-force + d3Bind.

**Out of scope (v1):**
- **Exit transitions** (`exit.transition().fade().remove()`). Delete fires immediately on join. Adding fade-out requires multi-phase exit semantics; deferred to v2 as `.exitTransition()` if a consumer asks.
- **`.attr()` mirror.** D3's `.attr('cx', fn)` has no clean target in the kit (no DOM attributes; some attrs route to pose, some to data, many have no analog). `.pose()` + `.data()` cover the same need with one less leaky abstraction.
- **DOM-bound d3 methods.** `.classed`, `.style`, `.html`, `.text`, `.on` (DOM events), `.append`, `.remove` (DOM), `.dispatch` — irrelevant.
- **`d3-selection.selectAll(...)` selector strings.** No DOM to query.
- **Chained transitions** (`selection.transition().transition()` — a second transition after the first completes). Defer; consumers can sequence via `await tA.end(); tB.start()`.
- **Tween of tween (`.attrTween`).** Replaced by `.tween()` escape hatch — same expressiveness via the interpolator slot.
- **d3-scale, d3-format, d3-hierarchy, d3-axis.** Work standalone with no bridging — consumers `import { scaleLinear } from 'd3-scale'` and call directly. Documented as "no bridge needed."

## Architecture

### Package layout

```
@weasel-js/d3
├── package.json          # peerDeps: @weasel-js/core, react. deps: d3-interpolate.
│                          # peerDepsMeta: d3-force optional (but recommended).
├── src/
│   ├── index.ts          # barrel
│   ├── bind.ts           # d3Bind() + D3Binding
│   ├── selection.ts      # D3Selection
│   ├── transition.ts     # D3Transition over useAnimator
│   ├── types.ts          # public types
│   └── *.test.ts
└── README.md
```

Lives under `packages/d3/` in the monorepo (next to `weasel-ui`, `weasel-hud`).

### Kit-side change (Phase 0)

`tween` already exposes a per-tick interpolator: `interpolate?: (from, to, t) => T`. That form is fine for cheap interpolations (numeric lerp, pose) but suboptimal for d3-interpolate-style interpolators that do expensive setup once (color space conversion, path-string parsing). Recreating that setup every tick is what we want to avoid.

Phase 0 adds a **factory form** alongside, additive — existing `interpolate` keeps working:

```ts
export type InterpolatorFactory<T> = (from: T, to: T) => (t: number) => T;

interface TweenOptions<T> {
  // ...existing fields...
  /** Per-tick interpolator. Re-runs per frame. */
  interpolate?: (from: T, to: T, t: number) => T;
  /** Factory interpolator. Built ONCE at tween start, called with t per frame.
   *  Use this for d3-interpolate or any interpolator with expensive setup. */
  interpolator?: InterpolatorFactory<T>;
}
```

`tween` impl precedence: `interpolator` (factory) > `interpolate` (per-tick) > default numeric lerp. When `interpolator` is set, the impl calls it once at tween start to build the closure, then invokes the closure with `easing(t)` each frame.

Independently useful for non-d3 consumers wanting color tweens (pair with any `(from, to) => (t) => v` function — d3-interpolate is one option, but you can write your own).

## Public API

### Phase 1: `d3Bind` + Selection

```ts
function d3Bind<TData, TLayer extends string, TPose>(
  scene: Scene<unknown, TLayer, TPose>,
  data: readonly TData[],
  options: {
    key: (d: TData) => string;
    layer?: TLayer;  // which scene layer new leaves enter on; defaults to scene's first system layer
  }
): D3Binding<TData, TPose>;

interface D3Binding<TData, TPose> {
  /** Per-datum pose. Called for both enter (initial pose) and update (target pose). */
  pose(fn: (d: TData, i: number) => TPose): this;

  /** Per-datum data payload. Merged into the leaf's existing data on update. */
  data(fn: (d: TData, i: number) => Record<string, unknown>): this;

  /** Emit the diff as one batched op group. Returns the merged selection (enter + update). */
  join(): D3Selection<TData, TPose>;

  /** Op-factory escape hatch. Each callback returns an Op or null (no-op).
   *  When provided, `.pose()` / `.data()` setters are ignored — the consumer
   *  is fully in control. */
  join(callbacks: {
    enter?: (d: TData, i: number) => Op | null;
    update?: (d: TData, i: number) => Op | null;
    exit?: (d: TData, i: number) => Op | null;
  }): D3Selection<TData, TPose>;

  /** Per-datum initial pose for ENTER nodes — used by `.transition()` to animate
   *  from this pose into the declared `.pose()`. Defaults to the same pose,
   *  so entries snap in unless `.enterFrom()` is set. */
  enterFrom(fn: (d: TData, i: number) => TPose): this;
}

interface D3Selection<TData, TPose> {
  /** Node ids in the same order as `data`. */
  readonly ids: readonly NodeId[];
  /** Bound data, in registration order. Stable across the lifetime of the selection. */
  readonly data: readonly TData[];

  /** Filter to a subset by predicate. */
  filter(pred: (d: TData, i: number) => boolean): D3Selection<TData, TPose>;

  /** Iterate. Imperative escape; returns this for chaining. */
  each(fn: (d: TData, id: NodeId, i: number) => void): this;

  /** Spawn a transition. Animates pose changes since the previous setPose
   *  for each node, unless overridden by `.tween()`. */
  transition(name?: string): D3Transition<TData, TPose>;

  /** Cancel any in-flight transitions matching `name` (or all if omitted) on these nodes. */
  interrupt(name?: string): this;
}
```

### Phase 2: Transition

```ts
interface D3Transition<TData, TPose> {
  duration(ms: number): this;

  ease(fn: EasingFn): this;

  /** Per-item delay. Function form spreads spawned tweens via animator.stagger. */
  delay(ms: number | ((d: TData, i: number) => number)): this;

  /** Tween a non-pose value. The animator runs an interpolation from `from` to `to`,
   *  calling `apply` each frame with the interpolated value. The consumer's `apply`
   *  is responsible for routing the value back into the scene (e.g. via setColor op
   *  or scene.update()). */
  tween<TValue>(opts: {
    name: string;
    from: (d: TData, i: number) => TValue;
    to: (d: TData, i: number) => TValue;
    interpolate?: (from: TValue, to: TValue) => (t: number) => TValue;
    apply: (d: TData, id: NodeId, value: TValue) => void;
  }): this;

  /** Lifecycle hooks. Called once per transition (not per spawned tween). */
  on(event: 'start' | 'end' | 'interrupt', fn: () => void): this;

  /** Cancel all spawned tweens. */
  interrupt(): void;

  /** Resolves when every spawned tween has finished (or been interrupted). */
  end(): Promise<void>;
}
```

## Tick / lifecycle semantics

### Join

`.join()` (no args, declarative):

1. Diff the bound `data` against the scene's current leaves on the configured layer, by key.
2. For each datum **not** in scene: emit `createInsertOp({ id: key(d), layer, pose: poseFn(d), data: dataFn(d) })`.
3. For each leaf in scene **not** in `data`: emit `createDeleteOp(id)`.
4. For each datum **in both** with changed pose / data: emit `createSetPoseOp(id, poseFn(d))` and/or `update(id, dataFn(d))`.
5. Dispatch the op batch through `scene.applyBatch` (or equivalent) as one history entry.
6. Construct the merged `D3Selection` covering all enter + update ids.

`.join({ enter, update, exit })` (op-factory mode):

Same diff, but each lifecycle category dispatches the consumer's callback. `.pose()` / `.data()` setters are not consulted. The merged selection still includes enter + update.

### Transition

**Pose `from` value.** The load-bearing timing question is: what pose does the tween start from? At the point `.transition()` is invoked, `.join()` has already written the new poses to the scene — so reading the current scene pose returns the *new* pose, not the prior one. Solution: **the binding snapshots each leaf's pose immediately before `.join()` mutates it**, indexed by key. The snapshot is consumed by `.transition()` to compute per-node `from`. For enter nodes (no prior pose), `.transition()` uses the *current* pose as `from` unless the consumer specifies `.enterFrom(d => Pose)` on the binding to declare an initial pose to animate from (e.g., a small/transparent rect for fade-in).

```ts
d3Bind(scene, data, { key })
  .pose(d => poseFor(d))
  .enterFrom(d => ({ ...poseFor(d), width: 0, height: 0 }))  // optional, for entry fade-in
  .join()
  .transition().duration(750).end();
```

**Per-node tween spawn.** For each selected node:

1. `from` pose = snapshot[key] (or `enterFrom` for new nodes).
2. `to` pose = current scene pose (set by `.join()`).
3. Spawn `animator.tween` interpolating `from` → `to` via `tweenPose`. The tween's onTick writes back via `scene.setPose` (consumer's `drawOne` re-renders).
4. If `.tween({ name, from, to, interpolate, apply })` registered additional values, spawn one tween per value per node with the registered interpolator.
5. Apply `delay` (per-item if function-form, via `animator.stagger`).

**Lifecycle:**
- `start` fires once when the first tween in the transition starts.
- `end` fires once when ALL spawned tweens have completed (or all were interrupted).
- `interrupt` fires once when `interrupt()` is called on the selection or transition.

**`interrupt(name)`** cancels via `animator.cancelKey(key)` — the cancelKey is `"d3-transition:" + transitionName + ":" + nodeId`. Named transitions don't collide (different names = different cancelKey namespaces).

### Named transitions

`.transition(name)` namespaces. Multiple concurrent transitions per node are allowed if their names differ — matches d3-transition. Default name is `""`.

## d3 idioms mapped

| d3 idiom | weasel-d3 equivalent |
|---|---|
| `selection.data(data, key).join(enter, update, exit)` | `d3Bind(scene, data, { key }).join({ enter, update, exit })` |
| `enter.append('rect')` | `enter: d => createInsertOp({ id, pose, data })` |
| `update.attr('x', d => x(d))` | `.pose(d => ({ x: x(d), y, w, h }))` or `update: d => createSetPoseOp(id, {...})` |
| `selection.attr('fill', d => color(d))` | `.data(d => ({ fill: color(d) }))` (consumer's drawOne reads from data) |
| `selection.transition().duration(750)` | `sel.transition().duration(750)` |
| `.ease(d3.easeCubicInOut)` | `.ease(easings.easeInOutCubic)` (d3 easings work directly too — same Penner math) |
| `.delay((d, i) => i * 50)` | `.delay((d, i) => i * 50)` |
| `.attrTween('fill', d => d3.interpolateRgb(prev, next))` | `.tween({ name: 'fill', from: d => prev(d), to: d => next(d), interpolate: d3.interpolateRgb, apply: (d, id, v) => scene.update(id, { fill: v }) })` |
| `transition.end()` | `.end()` (Promise) |
| `selection.interrupt()` | `.interrupt()` |
| Named transition: `.transition('foo')` | `.transition('foo')` |
| `d3.forceSimulation(nodes).force(...)` | `useSimulation({ nodes, forces })` (already shipped) |
| `d3.scaleLinear()` | Just `import { scaleLinear } from 'd3-scale'` — works standalone |
| `d3.hierarchy(root).sum(...).links()` | Same — produces positions, feed into `.pose()` |
| `d3.line()` / `d3.area()` / `d3.arc()` | Same — produces SVG path strings, consumer either parses or paths their own primitive |

## What still requires consumer adjustment

1. **No `.attr()` / `.style()`.** Map to `.pose()` / `.data()` + a custom `drawOne` that reads from data.
2. **No DOM events.** `.on('click', fn)` doesn't apply — wire pointer interactions through the kit's tool/action system.
3. **No SVG path string output.** Where d3 produces SVG path strings (`d3.line()`, `d3.arc()`), consumers either render them via the kit's text-based path parsing or convert to the kit's `Path` shape.
4. **Exit transitions defer until v2.** Fade-out before remove isn't supported; consumers either accept abrupt exits or pre-fade in a `.transition()` then call `.join()` after the fade settles.

## Open follow-ups (post-v1)

- **Exit transitions.** Multi-phase: schedule fade, then emit Delete on tween end. Probably `.join().exitTransition().fade()...` or `exit.fade(opts).then(remove)`.
- **Chained transitions.** `.transition().duration(500).transition().duration(500)` — sequence two tweens. Animator's loop primitive already supports this; the d3 chain just needs to thread it through.
- **`d3-scale`/`d3-axis` bridges.** Axes specifically need rendering (tick marks, labels). A `<D3Axis>` weasel-ui component or render-layer factory could absorb the d3-axis output. Defer until a real consumer wants axes inside a weasel canvas.
- **`d3-zoom` adapter.** d3-zoom has its own pan/zoom model. The kit has `useWheelZoomTool` / `useHandTool` / `useViewAnimation`. Bridging d3-zoom's event semantics to the kit's view-controller is a non-trivial mapping; probably not worth doing unless a consumer needs d3-zoom-specific features.
- **`d3-drag` adapter.** Same idea. The kit's `useDragGesture` covers the same shape; bridging gains little.
- **Type generic for `data` payload.** Currently `.data(fn)` returns `Record<string, unknown>` for simplicity. Could be tightened to track the data type across the binding for better autocompletion.
- **Optimizations.** v1 diffs `data` against scene state by walking — O(n) per join. For very large datasets, indexed diff (key map) is faster; trivial improvement when profiling demands it.

## Implementation phases

### Phase 0 — Animator interpolator slot (kit-side)

Single PR. `useAnimator.tween` accepts optional `interpolate`. Adds ~50 lines + 3 tests. Independent of the rest. Ships first as a small standalone landing.

### Phase 1 — `d3Bind` + Selection

Lands `@weasel-js/d3` package with `bind`, `selection`, types, README. Tests cover diff correctness (enter/update/exit emission), batched op dispatch, op-factory vs declarative modes, filter / each / interrupt. No transitions yet — `.transition()` throws `not implemented` placeholder.

Also lands the package's `package.json`, vitest setup, tsup config, and registry entry in the root workspace.

### Phase 2 — Transition

Adds `D3Transition` implementation backed by `useAnimator`. Tests cover duration / ease / delay (number + function), tween escape hatch with custom interpolator, lifecycle hooks, end Promise, interrupt, named transitions.

Plus one PoC demo (Les Misérables) under `demo/demos/D3PoCDemo.tsx` to validate the surface end-to-end.

## Testing

Per phase:

**Phase 0:**
- `tween({ interpolate })` with d3-interpolate's `interpolateRgb` produces correct intermediate colors.
- Default behavior unchanged when `interpolate` omitted.
- Type inference works for `tween<Color>` etc.

**Phase 1:**
- Diff: enter-only data → all InsertOps; exit-only data → all DeleteOps; mixed → correct partition.
- Key function stability: same key → same id mapping across joins.
- `.pose()` / `.data()` setters wire through to the right op fields.
- `.join({ enter, update, exit })` callback mode wins over setters.
- `.filter` / `.each` / `.interrupt` work as documented.
- Empty data → empty selection, no ops.
- Repeated joins are idempotent for unchanged data.

**Phase 2:**
- Pose transition: spawned tween reaches target pose at `t = duration`.
- `.delay(fn)` stagger spawns tweens at correct offsets.
- `.tween()` escape: custom interpolator called with `t ∈ [0, 1]`, `apply` invoked per frame.
- `.end()` Promise resolves after all tweens settle.
- `.interrupt()` cancels in-flight, resolves end Promise with `'interrupt'` lifecycle hook fired.
- Named transitions don't cancel each other.

**Demo (Phase 2 deliverable):**
- Renders Les Misérables co-occurrence graph: 77 nodes, 254 weighted links.
- d3-force forces drive layout via `useSimulation`.
- `d3Bind` wires the dataset into the scene initially.
- Drag-to-pin works (carried over from force-graph demo pattern).
- A "Filter by group" toggle uses `.filter()` + `.transition()` to fade subsets in/out (or, until exit transitions ship, just pose-shrinks them then re-expands).

## Public exports

`@weasel-js/d3/src/index.ts`:

```ts
export { d3Bind } from './bind';
export type {
  D3Binding,
  D3Selection,
  D3Transition,
} from './types';
```

The kit's `@weasel-js/core` doesn't change its public surface (Phase 0 is an additive optional arg on `tween`).

## Dependencies

| Package | Type | Why |
|---|---|---|
| `@weasel-js/core` | peerDep | Scene, useAnimator, op factories, types |
| `react` | peerDep | (transitively via weasel) |
| `d3-interpolate` | dep | Used by `.tween()` defaults; consumer can override |
| `d3-force` | peerDepMeta optional | Recommended pairing; not strictly required by this package |
| `d3-ease` | peerDepMeta optional | Drop-in for ease functions; kit's own `easings` also works |

Bundle cost without optional deps: ~30kb gzipped (d3-interpolate + plugin code).
