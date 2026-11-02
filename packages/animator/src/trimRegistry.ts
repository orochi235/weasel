import { createTarget, type Target } from './target';

/** A stroke trim's window edges as fractions of the path, as `Stroke.trim`'s bare numbers are:
 *  of the length or the anchor range, by the stroke's own `pace`. An edge left out keeps the
 *  stroke's own. */
export interface TrimOverride {
  start?: number;
  end?: number;
}

/** Both edges of a trim window, as a {@link TrimOverrideRegistry.target} moves them. */
export interface TrimWindow {
  start: number;
  end: number;
}

/** One node's target, and whether what it holds is painted. */
interface TrimSlot {
  target: Target<TrimWindow>;
  value: TrimWindow;
  /** False until an animation commits. */
  painted: boolean;
  released: boolean;
}

/** Per-node store of stroke trim overrides. Attached to `useAnimator` as
 *  `animator.trimOverrides`; painted onto scene nodes by `<SceneCanvas animator>`. Picking reads
 *  the authored `Stroke.trim` and never these. */
export class TrimOverrideRegistry {
  private readonly map = new Map<string, TrimOverride>();
  private readonly slots = new Map<string, TrimSlot>();
  private _version = 0;

  set(id: string, override: TrimOverride): void {
    this.map.set(id, { ...override });
    this._version++;
  }

  /** Drops `id`'s override, and the window a finished or canceled animation on its
   *  {@link target} left painted. An animation still running goes on. */
  clear(id: string): void {
    this.release(id);
    if (this.map.delete(id)) this._version++;
  }

  clearAll(): void {
    for (const id of [...this.slots.keys()]) this.release(id);
    if (this.map.size === 0) return;
    this.map.clear();
    this._version++;
  }

  /** What `set` stored for `id`; failing that, the window its {@link target} paints. */
  get(id: string): TrimOverride | undefined {
    const override = this.map.get(id);
    if (override !== undefined) return override;
    const slot = this.slots.get(id);
    return slot?.painted ? slot.target.read() : undefined;
  }

  /** Whether anything overrides `id`'s trim. */
  has(id: string): boolean {
    return this.map.has(id) || this.slots.has(id);
  }

  /**
   * The {@link Target} for `id`'s trim window, committed at the whole stroke (`0` to `1`) until
   * something moves it. Every caller for one node gets the same one, so their animations add.
   * The registry holds its committed window and nothing writes the scene.
   *
   * What it paints: with no override from `set`, both its edges in place of the stroke's own;
   * over one, only what its animations have left to travel, added to the edges that override
   * sets. Ask again for each animation rather than keeping it: {@link release} and {@link clear}
   * drop a resting one, and the target it had throws from then on.
   */
  target(id: string): Target<TrimWindow> {
    const held = this.slots.get(id);
    if (held) return held.target;
    const state: Omit<TrimSlot, 'target'> = { value: { start: 0, end: 1 }, painted: false, released: false };
    const target = createTarget<TrimWindow>({
      get: () => ({ ...state.value }),
      set: (value) => {
        if (state.released) throw new Error(`trim overrides: ${id}'s target was released`);
        state.value = { start: value.start, end: value.end };
        state.painted = true;
        this._version++;
      },
      show: () => { this._version++; },
    });
    const slot: TrimSlot = Object.assign(state, { target });
    this.slots.set(id, slot);
    return slot.target;
  }

  /** Drops the window `id`'s {@link target} left painted, unless an animation is still moving
   *  it. An override from `set` stays. */
  release(id: string): void {
    const slot = this.slots.get(id);
    if (!slot || slot.target.active) return;
    this.slots.delete(id);
    slot.released = true;
    if (slot.painted) this._version++;
  }

  /**
   * The edges to paint on `id`'s stroke: the override from `set`, plus what a {@link target}
   * in motion has left to travel on each edge it sets; with no override, the target's window
   * once an animation has committed it. `undefined` leaves the stroke's own trim.
   */
  resolve(id: string): TrimOverride | undefined {
    const override = this.map.get(id);
    const slot = this.slots.get(id);
    if (override === undefined) return slot?.painted ? slot.target.read() : undefined;
    if (!slot?.painted || !slot.target.active) return override;
    const shown = slot.target.read();
    const out: TrimOverride = {};
    if (override.start !== undefined) out.start = override.start + shown.start - slot.value.start;
    if (override.end !== undefined) out.end = override.end + shown.end - slot.value.end;
    return out;
  }

  version(): number {
    return this._version;
  }
}
