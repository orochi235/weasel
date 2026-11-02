import { createEmitter } from '@weasel-js/registry';
import { createTarget, type Target } from './target';

/** A stroke trim's window edges as fractions of the path, as `Stroke.trim`'s bare numbers are:
 *  of the length or the anchor range, by the stroke's own `pace`. An edge left out keeps the
 *  stroke's own. */
export interface TrimOverride {
  start?: number;
  end?: number;
}

/** One edge of a trim window. */
export type TrimEdge = 'start' | 'end';

const EDGES: readonly TrimEdge[] = ['start', 'end'];

/** One node and edge's target, and whether what it holds is painted. */
interface EdgeSlot {
  target: Target<number>;
  value: number;
  /** False until an animation commits. */
  painted: boolean;
  released: boolean;
}

type NodeSlots = Partial<Record<TrimEdge, EdgeSlot>>;

/** Per-node, per-edge store of stroke trim overrides. Attached to `useAnimator` as
 *  `animator.trimOverrides`; painted onto scene nodes by `<SceneCanvas animator>`. Picking reads
 *  the authored `Stroke.trim` and never these. */
export class TrimOverrideRegistry {
  private readonly map = new Map<string, TrimOverride>();
  private readonly slots = new Map<string, NodeSlots>();
  private readonly listeners = createEmitter();
  private _version = 0;

  set(id: string, override: TrimOverride): void {
    this.map.set(id, { ...override });
    this.changed();
  }

  /** Drops `id`'s override, and the edges a finished or canceled animation on its
   *  {@link target}s left painted. An animation still running goes on. */
  clear(id: string): void {
    for (const edge of EDGES) this.release(id, edge);
    if (this.map.delete(id)) this.changed();
  }

  clearAll(): void {
    for (const [id, node] of [...this.slots]) {
      for (const edge of Object.keys(node) as TrimEdge[]) this.release(id, edge);
    }
    if (this.map.size === 0) return;
    this.map.clear();
    this.changed();
  }

  /** What paints on `id`'s edges now: see {@link resolve}. */
  get(id: string): TrimOverride | undefined {
    return this.resolve(id);
  }

  /** Whether anything paints over `id`'s trim: an override from `set`, or a target an
   *  animation has committed. A target asked for and never moved does not count. */
  has(id: string): boolean {
    if (this.map.has(id)) return true;
    const node = this.slots.get(id);
    return node !== undefined && (node.start?.painted === true || node.end?.painted === true);
  }

  /**
   * The {@link Target} for `id`'s `edge`, committed at the whole stroke's (`start` 0, `end` 1)
   * until something moves it. Every caller for one node and edge gets the same one, so their
   * animations add. The registry holds its committed value and nothing writes the scene.
   *
   * What it paints, on its own edge only: with no override from `set` on that edge, its value in
   * place of the stroke's own; over one, only what its animations have left to travel, added on
   * top. Ask again for each animation rather than keeping it: {@link release} and {@link clear}
   * drop a resting one, and the target it had throws from then on.
   */
  target(id: string, edge: TrimEdge): Target<number> {
    let node = this.slots.get(id);
    const held = node?.[edge];
    if (held) return held.target;
    const state: Omit<EdgeSlot, 'target'> = { value: edge === 'start' ? 0 : 1, painted: false, released: false };
    const target = createTarget<number>({
      get: () => state.value,
      set: (value) => {
        if (state.released) throw new Error(`trim overrides: ${id}'s ${edge} target was released`);
        state.value = value;
        state.painted = true;
        // An animation's commit repaints through onTick; a bare one has nothing else to.
        if (target.active) this._version++;
        else this.changed();
      },
      show: () => { this._version++; },
    });
    if (!node) {
      node = {};
      this.slots.set(id, node);
    }
    node[edge] = Object.assign(state, { target });
    return target;
  }

  /** Drops the value `id`'s {@link target} on `edge` left painted, unless an animation is still
   *  moving it. An override from `set` stays. */
  release(id: string, edge: TrimEdge): void {
    const node = this.slots.get(id);
    const slot = node?.[edge];
    if (!node || !slot || slot.target.active) return;
    delete node[edge];
    if (!node.start && !node.end) this.slots.delete(id);
    slot.released = true;
    if (slot.painted) this.changed();
  }

  /**
   * The edges to paint on `id`'s stroke, each on its own: the override from `set` for that
   * edge plus what its {@link target} has left to travel; failing a `set` value, the target's
   * value once an animation has committed it. An edge with neither is left out, so the stroke's
   * own stands. `undefined` when neither edge is overridden.
   */
  resolve(id: string): TrimOverride | undefined {
    const override = this.map.get(id);
    const node = this.slots.get(id);
    const start = edgeOf(override?.start, node?.start);
    const end = edgeOf(override?.end, node?.end);
    if (start === undefined && end === undefined) return undefined;
    return { ...(start !== undefined ? { start } : {}), ...(end !== undefined ? { end } : {}) };
  }

  /** Calls `listener` after a `set`, `clear`, or release changes what paints; an animation's
   *  frames reach a painter through `animator.onTick` instead. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void {
    return this.listeners.subscribe(listener);
  }

  version(): number {
    return this._version;
  }

  private changed(): void {
    this._version++;
    this.listeners.emit();
  }
}

/** One edge's painted value: `set`'s plus a moving target's travel, else a painted target's. */
function edgeOf(set: number | undefined, slot: EdgeSlot | undefined): number | undefined {
  const painted = slot?.painted === true;
  if (set === undefined) return painted ? slot!.target.read() : undefined;
  return painted && slot!.target.active ? set + slot!.target.read() - slot!.value : set;
}
