/**
 * The registry-keyed function fields a node can carry, as a table.
 *
 * `clipFromPose`, `derivePath` and `derivePose` are live functions on a node,
 * and a function travels through neither a serializable op payload nor a JSON
 * snapshot. Each one therefore needs the same six things: a function→key
 * reverse map, a side-channel cache the `kit:add` redo path re-attaches from,
 * a name in the op payload, a name in the snapshot, a registry lookup on
 * restore, and a prune when history evicts the entry that could reach it.
 *
 * The first two fields were written out twice, and `types.ts` said in a
 * comment that a third should be the point it stopped being copied per field.
 * This is that point.
 */
import type { NodeId, SceneRegistry } from './types';

/** A node's function field, opaque here: the table moves these around by
 *  reference and never calls one. Each field's real signature lives on `Node`. */
export type NodeFn = (...args: never[]) => unknown;

/** A node as this module reads it — a bag with the three fields on it. The
 *  full `Node` type would make the table generic in `TData`/`TLayer` for no
 *  gain; nothing here looks at either. */
export type FnBearingNode = { id: NodeId; kind: 'leaf' | 'container' } & {
  [K in NodeFnFieldName]?: NodeFn;
};

export type NodeFnFieldName = 'clipFromPose' | 'derivePath' | 'derivePose';

export interface NodeFnFieldSpec {
  /** The field's name on `Node` — and, deliberately, its name in
   *  `SceneRegistry` too, so one string indexes both. */
  readonly field: NodeFnFieldName;
  /** Its key in the `kit:add` and `kit:remove` op payloads. `clipFromPose`'s
   *  is the short one because a persisted history already carries that name. */
  readonly opKey: string;
  /** Its key in a `SerializedNode`. */
  readonly jsonKey: string;
  /** True for a field only a `ContainerNode` can carry. */
  readonly containersOnly: boolean;
  /** What a node loses when its key is not in the registry, for the warning. */
  readonly lost: string;
}

export const NODE_FN_FIELDS: readonly NodeFnFieldSpec[] = [
  {
    field: 'clipFromPose',
    opKey: 'clipKey',
    jsonKey: 'clipFromPoseKey',
    containersOnly: true,
    lost: 'clip',
  },
  {
    field: 'derivePath',
    opKey: 'derivePathKey',
    jsonKey: 'derivePathKey',
    containersOnly: false,
    lost: 'derived path',
  },
  {
    field: 'derivePose',
    opKey: 'derivePoseKey',
    jsonKey: 'derivePoseKey',
    containersOnly: false,
    lost: 'derived pose',
  },
];

/** One field's per-scene state. */
export interface NodeFnField {
  readonly spec: NodeFnFieldSpec;
  /** `fn → registry key`, for writing a payload or a snapshot. */
  keyOf(fn: NodeFn): string | undefined;
  /** `registry key → fn`, for restoring one. */
  fnOf(key: string): NodeFn | undefined;
  /** The function on `node`, or `undefined` — including when the field is
   *  container-only and `node` is a leaf. */
  read(node: FnBearingNode): NodeFn | undefined;
  /** Attach `fn` to `node`, ignoring a container-only field on a leaf. */
  write(node: FnBearingNode, fn: NodeFn): void;
  /** The redo side-channel: `kit:add` replays without the original spec, so
   *  the function it should re-attach is cached here by node id. */
  readonly pending: Map<NodeId, NodeFn>;
}

export function createNodeFnFields<TPose>(registry: SceneRegistry<TPose>): readonly NodeFnField[] {
  return NODE_FN_FIELDS.map((spec) => {
    const table = registry[spec.field] as Readonly<Record<string, NodeFn>> | undefined;
    const reverse = new Map<NodeFn, string>();
    if (table) for (const [key, fn] of Object.entries(table)) reverse.set(fn, key);
    const pending = new Map<NodeId, NodeFn>();
    const applies = (node: FnBearingNode): boolean =>
      !spec.containersOnly || node.kind === 'container';
    return {
      spec,
      keyOf: (fn) => reverse.get(fn),
      fnOf: (key) => table?.[key],
      read: (node) => (applies(node) ? node[spec.field] : undefined),
      write: (node, fn) => {
        if (applies(node)) node[spec.field] = fn;
      },
      pending,
    };
  });
}

/**
 * Attach the function `key` names to `node`, seeding the redo cache so later
 * undo/redo cycles behave like the live path. Warns and leaves the field
 * unset when the key is not in this scene's registry — a snapshot outliving
 * the code that registered its functions must still load.
 */
export function restoreFn(
  field: NodeFnField,
  node: FnBearingNode,
  key: string,
  site: string,
  warn: (channel: string, message: string) => void,
): void {
  const fn = field.fnOf(key);
  if (fn === undefined) {
    warn(
      'scene',
      `${site}: ${field.spec.opKey} "${key}" not in this scene's registry — node "${node.id}" ` +
        `restored without its ${field.spec.lost}. Register a function with this key in the ` +
        `registry option to restore it.`,
    );
    return;
  }
  field.write(node, fn);
  field.pending.set(node.id, fn);
}

/** The `{ clipKey?, derivePathKey?, … }` an op payload or a snapshot carries
 *  for `node`. Empty when the node has no keyed function on it. */
export function fnKeysOf(
  fields: readonly NodeFnField[],
  node: FnBearingNode,
  which: 'opKey' | 'jsonKey',
  onUnregistered?: (field: NodeFnField) => never,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    const fn = field.read(node);
    if (fn === undefined) continue;
    const key = field.keyOf(fn);
    if (key === undefined) {
      onUnregistered?.(field);
      continue;
    }
    out[field.spec[which]] = key;
  }
  return out;
}

/**
 * The function fields to carry from a live node into an `AddNodeSpec`. An
 * insert that drops them brings an edge back as a static path that never
 * follows its endpoints again, and a clipped container back with nothing
 * clipped.
 */
export function fnFieldsOfNode<T extends { kind: 'leaf' | 'container' }>(
  node: T,
): Partial<Pick<T, Extract<NodeFnFieldName, keyof T>>> {
  const src = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const spec of NODE_FN_FIELDS) {
    if (spec.containersOnly && node.kind !== 'container') continue;
    const fn = src[spec.field];
    if (fn !== undefined) out[spec.field] = fn;
  }
  return out as Partial<Pick<T, Extract<NodeFnFieldName, keyof T>>>;
}
