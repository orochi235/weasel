import { createTarget, type Target } from './target';

/** Which of a node's two per-anchor color arrays an override applies to. */
export type VertexColorChannel = 'fill' | 'stroke';

/** Function-form override: receives the consumer-supplied base color
 *  array and the current animation timestamp (ms, from the animator's
 *  clock). Returns a flat RGBA float array (values in 0..1, matching
 *  the renderer's `stroke.vertexColors` / `PathDrawCommand.vertexColors`
 *  color space) of the same length as `base`. */
export type ColorOverrideFn = (base: readonly number[], tMs: number) => number[];

/** Either a static per-anchor RGBA float array (0..1) or a function-form
 *  override (see {@link ColorOverrideFn}). */
export type ColorOverride = readonly number[] | ColorOverrideFn;

interface NodeOverrides {
  fill?: ColorOverride;
  stroke?: ColorOverride;
}

/** One node and channel's {@link Target}, and the colors its animations add to. */
interface ColorSlot {
  readonly target: Target<number[]>;
  readonly length: number;
  /** Null until an animation commits, and again once what it painted is dropped. */
  committed: number[] | null;
}

type NodeSlots = Partial<Record<VertexColorChannel, ColorSlot>>;

/** Per-node, per-channel store of color overrides. Attached to `useAnimator` as
 *  `animator.colorOverrides`; painted onto scene nodes by `<SceneCanvas animator>`
 *  and onto a `createPathLayer`'s nodes by its `colorOverrides` option. */
export class ColorOverrideRegistry {
  private readonly map = new Map<string, NodeOverrides>();
  private readonly slots = new Map<string, NodeSlots>();
  private _version = 0;

  set(id: string, channel: VertexColorChannel, override: ColorOverride): void {
    let entry = this.map.get(id);
    if (!entry) {
      entry = {};
      this.map.set(id, entry);
    }
    entry[channel] = override;
    this._version++;
  }

  /** Drops `id`'s override on `channel`, and the colors a finished or canceled animation on its
   *  {@link target} left painted. An animation still running goes on. */
  clear(id: string, channel: VertexColorChannel): void {
    this.release(id, channel);
    const entry = this.map.get(id);
    if (!entry) return;
    if (!(channel in entry)) return;
    delete entry[channel];
    if (!entry.fill && !entry.stroke) this.map.delete(id);
    this._version++;
  }

  clearAll(): void {
    for (const [id, node] of this.slots) {
      for (const channel of Object.keys(node) as VertexColorChannel[]) this.release(id, channel);
    }
    if (this.map.size === 0) return;
    this.map.clear();
    this._version++;
  }

  /** What `set` stored for `id`'s `channel`; failing that, the colors its {@link target} paints. */
  get(id: string, channel: VertexColorChannel): ColorOverride | undefined {
    const override = this.map.get(id)?.[channel];
    if (override !== undefined) return override;
    const slot = this.slots.get(id)?.[channel];
    return slot?.committed ? slot.target.read() : undefined;
  }

  /** Whether anything overrides `id`, on either channel. */
  has(id: string): boolean {
    return this.map.has(id) || this.slots.has(id);
  }

  /**
   * The {@link Target} for `id`'s colors on `channel`: `length` numbers, flat RGBA per anchor.
   * Every caller for one node and channel gets the same one, so their animations add. The
   * registry holds its committed colors and nothing writes the scene.
   *
   * What it paints: with no override from `set`, its colors in place of the painter's own; over
   * one, only what its animations have left to travel, added on top. Ask again for each
   * animation rather than keeping it, since {@link release} and {@link clear} forget a resting one.
   */
  target(id: string, channel: VertexColorChannel, length: number): Target<number[]> {
    if (!(length > 0) || length % 4 !== 0) {
      throw new Error(`vertex colors: length ${length} must be a positive multiple of 4`);
    }
    let node = this.slots.get(id);
    const held = node?.[channel];
    if (held?.length === length) return held.target;
    if (held?.target.active) {
      throw new Error(`vertex colors: ${id}'s ${channel} is moving as ${held.length} numbers, not ${length}`);
    }
    const zeros = new Array<number>(length).fill(0);
    const slot = { length, committed: null } as { -readonly [K in keyof ColorSlot]: ColorSlot[K] };
    slot.target = createTarget<number[]>({
      get: () => slot.committed ?? zeros,
      set: (colors) => {
        slot.committed = colors.slice();
        // One released while resting comes back when it is moved again.
        const at = this.slots.get(id) ?? {};
        at[channel] ??= slot;
        this.slots.set(id, at);
        this._version++;
      },
      show: () => { this._version++; },
    });
    if (!node) {
      node = {};
      this.slots.set(id, node);
    }
    node[channel] = slot;
    return slot.target;
  }

  /** Drops the colors `id`'s {@link target} on `channel` left painted, unless an animation is
   *  still moving it. An override from `set` stays. */
  release(id: string, channel: VertexColorChannel): void {
    const node = this.slots.get(id);
    const slot = node?.[channel];
    if (!node || !slot || slot.target.active) return;
    delete node[channel];
    if (!node.fill && !node.stroke) this.slots.delete(id);
    if (!slot.committed) return;
    slot.committed = null;
    this._version++;
  }

  /**
   * The colors to paint on `id`'s `channel`, given the colors the painter would
   * otherwise paint and the frame's timestamp. A function override needs that
   * `base` and must return an array of its length; failing either, `base`
   * stands. A {@link target} in motion then adds what it has left to travel.
   */
  resolve(
    id: string,
    channel: VertexColorChannel,
    base: readonly number[] | undefined,
    tMs: number,
  ): readonly number[] | undefined {
    const override = this.map.get(id)?.[channel];
    const slot = this.slots.get(id)?.[channel];
    const committed = slot?.committed;
    if (override === undefined) return committed ? slot!.target.read() : base;
    const under = typeof override === 'function' ? this.apply(override, base, tMs) : override;
    if (!committed || !slot!.target.active || under?.length !== committed.length) return under;
    const shown = slot!.target.read();
    return under.map((x, i) => x + shown[i]! - committed[i]!);
  }

  private apply(
    override: ColorOverrideFn,
    base: readonly number[] | undefined,
    tMs: number,
  ): readonly number[] | undefined {
    if (base === undefined) return undefined;
    const result = override(base, tMs);
    return result.length === base.length ? result : base;
  }

  version(): number {
    return this._version;
  }
}
