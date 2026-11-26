import { createPart } from '@weasel-js/registry';
import { createTarget, type Target, type TargetAxes } from '@weasel-js/animator';
import type { NodeId, PoseOverride, PoseOverrides } from '../core/scene/types';

/**
 * One field of a node's data, as a target moves it: `get` reads it off the data, and `with` answers
 * the data with it replaced, leaving the data it was given alone. `key` names the field among a
 * node's targets, so two lenses with one key are one field.
 */
export interface DataLens<TData, T> {
  readonly key: string;
  get(data: TData): T;
  with(data: TData, value: T): TData;
}

/** The part of a scene {@link sceneDataTarget} reads and writes. A `Scene` satisfies it. */
export interface DataTargetScene<TData> {
  readonly overrides: PoseOverrides<unknown, TData>;
  get(id: NodeId): { data: TData } | undefined;
  update(id: NodeId, patch: { data: TData }): void;
  untracked<T>(fn: () => T): T;
}

/** One node's animated fields: the values shown now, by lens, and the one ply that shows them. */
interface NodeFields {
  readonly shown: Map<string, { lens: DataLens<unknown, unknown>; value: unknown }>;
  readonly ply: PoseOverride<unknown, unknown>;
}

interface Table {
  readonly targets: Map<string, Target<unknown>>;
  readonly nodes: Map<string, NodeFields>;
}

const tables = createPart((_overrides: object): Table => ({ targets: new Map(), nodes: new Map() }));
const publisherOf = createPart((overrides: { commit(): void }): (() => void) => () => overrides.commit());

/** Installs `fields`' ply with a fresh function, so the shown data is made again, or clears it when nothing is shown. */
function reshow(overrides: PoseOverrides<unknown, unknown>, id: NodeId, fields: NodeFields): void {
  if (fields.shown.size === 0) {
    overrides.clear(id, fields.ply);
    return;
  }
  const shown = [...fields.shown.values()];
  fields.ply.data = (stored) => shown.reduce((data, { lens, value }) => lens.with(data, value), stored);
  if (!overrides.has(id, fields.ply)) overrides.set(id, fields.ply);
}

/**
 * The target of one field of node `id`'s data in `scene`: the same one on every call with the same
 * `lens.key`, so everything animating the field adds. Its committed value is the field in the
 * node's stored data, written without recording; the value on screen reaches painting and picking
 * through the scene's overrides, one ply per node however many of its fields move, cleared when
 * they come to rest.
 *
 * Undefined for a node not in the scene. Throws, as `createTarget` does, for a field with no
 * axes unless `axes` maps it. Nothing here reads a pose, so a scene of any pose takes it.
 */
export function sceneDataTarget<TData, T>(
  scene: DataTargetScene<TData>,
  id: string,
  lens: DataLens<TData, T>,
  axes?: TargetAxes<T>,
): Target<T> | undefined {
  const table = tables(scene.overrides);
  const nid = id as NodeId;
  const name = `${id}\u0000${lens.key}`;
  const held = table.targets.get(name) as Target<T> | undefined;
  if (held?.active || (held && scene.get(nid))) return held;
  if (!scene.get(nid)) {
    table.targets.delete(name);
    return undefined;
  }
  const overrides = scene.overrides as PoseOverrides<unknown, unknown>;
  const fields = (): NodeFields => {
    let f = table.nodes.get(id);
    if (!f) table.nodes.set(id, f = { shown: new Map(), ply: {} });
    return f;
  };
  let last = lens.get(scene.get(nid)!.data);
  const rest = (): void => {
    const f = table.nodes.get(id);
    if (!f?.shown.delete(lens.key)) return;
    reshow(overrides, nid, f);
    if (f.shown.size === 0) table.nodes.delete(id);
    if (!scene.get(nid)) table.targets.delete(name);
  };
  const target: Target<T> = createTarget<T>({
    get() {
      const n = scene.get(nid);
      if (n) last = lens.get(n.data);
      return last;
    },
    set(value) {
      const n = scene.get(nid);
      if (n) scene.untracked(() => scene.update(nid, { data: lens.with(n.data, value) }));
    },
    axes,
    show(value) {
      if (!target.active) {
        rest();
        return;
      }
      const f = fields();
      f.shown.set(lens.key, { lens: lens as DataLens<unknown, unknown>, value });
      reshow(overrides, nid, f);
    },
    publish: publisherOf(overrides),
  });
  table.targets.set(name, target as Target<unknown>);
  return target;
}
