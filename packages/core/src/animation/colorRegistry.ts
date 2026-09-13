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

/** Per-node, per-channel store of color overrides. Attached to `useAnimator` as
 *  `animator.colorOverrides`; painted onto scene nodes by `<SceneCanvas animator>`
 *  and onto a `createPathLayer`'s nodes by its `colorOverrides` option. */
export class ColorOverrideRegistry {
  private readonly map = new Map<string, NodeOverrides>();
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

  clear(id: string, channel: VertexColorChannel): void {
    const entry = this.map.get(id);
    if (!entry) return;
    if (!(channel in entry)) return;
    delete entry[channel];
    if (!entry.fill && !entry.stroke) this.map.delete(id);
    this._version++;
  }

  clearAll(): void {
    if (this.map.size === 0) return;
    this.map.clear();
    this._version++;
  }

  get(id: string, channel: VertexColorChannel): ColorOverride | undefined {
    return this.map.get(id)?.[channel];
  }

  /** Whether anything overrides `id`, on either channel. */
  has(id: string): boolean {
    return this.map.has(id);
  }

  /**
   * The colors to paint on `id`'s `channel`, given the colors the painter would
   * otherwise paint and the frame's timestamp. A function override needs that
   * `base` and must return an array of its length; failing either, `base`
   * stands.
   */
  resolve(
    id: string,
    channel: VertexColorChannel,
    base: readonly number[] | undefined,
    tMs: number,
  ): readonly number[] | undefined {
    const override = this.get(id, channel);
    if (override === undefined) return base;
    if (typeof override !== 'function') return override;
    if (base === undefined) return undefined;
    const result = override(base, tMs);
    return result.length === base.length ? result : base;
  }

  version(): number {
    return this._version;
  }
}
