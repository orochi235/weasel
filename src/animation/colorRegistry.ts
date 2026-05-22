export type VertexColorChannel = 'fill' | 'stroke';

/** Function-form override: receives the consumer-supplied base color array
 *  and the current animation timestamp (ms, from the animator's clock).
 *  Returns a flat RGBA byte array of the same length as `base`. */
export type ColorOverrideFn = (base: readonly number[], tMs: number) => number[];

export type ColorOverride = readonly number[] | ColorOverrideFn;

interface NodeOverrides {
  fill?: ColorOverride;
  stroke?: ColorOverride;
}

/** Per-node, per-channel store of color overrides consulted by `createPathLayer`
 *  before falling back to the consumer's `getVertexColors` / `getStrokeVertexColors`
 *  accessor. Attached to `useAnimator` as `animator.colorOverrides`. */
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

  version(): number {
    return this._version;
  }
}
