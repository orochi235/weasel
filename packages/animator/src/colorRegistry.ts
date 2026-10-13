import type { Target } from './target';
import { createTargetTable, type TargetTable } from './targetTable';

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

/** One node and channel's row in the table of colors as long as its own. */
interface ColorSlot {
  readonly table: TargetTable;
  readonly row: number;
  readonly length: number;
  /** False until an animation commits, and again once what it painted is dropped. */
  painted: boolean;
}

/** Every slot of one length: a table whose rows are that many numbers, and who holds each row. */
interface ColorTable {
  readonly table: TargetTable;
  readonly rows: (ColorSlot | undefined)[];
}

type NodeSlots = Partial<Record<VertexColorChannel, ColorSlot>>;

/** Per-node, per-channel store of color overrides. Attached to `useAnimator` as
 *  `animator.colorOverrides`; painted onto scene nodes by `<SceneCanvas animator>`
 *  and onto a `createPathLayer`'s nodes by its `colorOverrides` option. */
export class ColorOverrideRegistry {
  private readonly map = new Map<string, NodeOverrides>();
  private readonly slots = new Map<string, NodeSlots>();
  private readonly tables = new Map<number, ColorTable>();
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
    return slot?.painted ? shownOf(slot) : undefined;
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
   * animation rather than keeping it: {@link release} and {@link clear} drop a resting one, and
   * the target it had throws from then on.
   */
  target(id: string, channel: VertexColorChannel, length: number): Target<number[]> {
    if (!(length > 0) || length % 4 !== 0) {
      throw new Error(`vertex colors: length ${length} must be a positive multiple of 4`);
    }
    let node = this.slots.get(id);
    const held = node?.[channel];
    if (held?.length === length) return held.table.target(held.row);
    if (held) {
      if (held.table.target(held.row).active) {
        throw new Error(`vertex colors: ${id}'s ${channel} is moving as ${held.length} numbers, not ${length}`);
      }
      this.drop(held);
    }
    const at = this.tableOf(length);
    const row = at.table.add(new Float64Array(length));
    const slot: ColorSlot = { table: at.table, row, length, painted: false };
    at.rows[row] = slot;
    if (!node) {
      node = {};
      this.slots.set(id, node);
    }
    node[channel] = slot;
    return at.table.target(row);
  }

  private tableOf(length: number): ColorTable {
    const held = this.tables.get(length);
    if (held) return held;
    const rows: (ColorSlot | undefined)[] = [];
    const table = createTargetTable({
      axes: length,
      set: (row) => {
        const slot = rows[row];
        if (slot) slot.painted = true;
        this._version++;
      },
      show: () => { this._version++; },
    });
    const made = { table, rows };
    this.tables.set(length, made);
    return made;
  }

  private drop(slot: ColorSlot): void {
    const at = this.tables.get(slot.length)!;
    at.rows[slot.row] = undefined;
    slot.table.remove(slot.row);
    if (slot.table.size === 0) this.tables.delete(slot.length);
  }

  /** Drops the colors `id`'s {@link target} on `channel` left painted, unless an animation is
   *  still moving it. An override from `set` stays. */
  release(id: string, channel: VertexColorChannel): void {
    const node = this.slots.get(id);
    const slot = node?.[channel];
    if (!node || !slot || slot.table.target(slot.row).active) return;
    delete node[channel];
    if (!node.fill && !node.stroke) this.slots.delete(id);
    this.drop(slot);
    if (slot.painted) this._version++;
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
    if (override === undefined) return slot?.painted ? shownOf(slot) : base;
    const under = typeof override === 'function' ? this.apply(override, base, tMs) : override;
    if (!slot?.painted || under?.length !== slot.length || !slot.table.target(slot.row).active) return under;
    const { shown, committed } = slot.table;
    const at = slot.row * slot.length;
    return under.map((x, i) => x + shown[at + i]! - committed[at + i]!);
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

/** The colors `slot`'s row shows now. */
function shownOf(slot: ColorSlot): number[] {
  const { shown } = slot.table;
  const at = slot.row * slot.length;
  const out = new Array<number>(slot.length);
  for (let i = 0; i < out.length; i++) out[i] = shown[at + i]!;
  return out;
}
