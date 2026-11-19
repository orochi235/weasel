/**
 * The shape a snapshot must have before anything reads it. A snapshot is JSON from a file or the wire, so it is
 * checked here and refused with a `SnapshotShapeError` naming what is wrong, rather than half read until some
 * field turns out not to be there.
 */
import { NODE_FN_FIELDS } from './nodeFnFields';
import { SnapshotShapeError } from './snapshotShapeError';
import { isPlainObject } from '@weasel-js/registry';

export { SnapshotShapeError };

/** A snapshot naming a registry key the loading scene has no function under, read without `unknownKeys: 'skip'`. */
export class SnapshotKeyError extends Error {
  override name = 'SnapshotKeyError';

  constructor(
    /** The node that names the key. */
    readonly id: string,
    /** The registry field the key was looked up in, such as `clipFromPose`. */
    readonly field: string,
    readonly key: string,
  ) {
    super(`Scene: unknown ${field} key '${key}'. Register a function with this key in the registry option.`);
  }
}

const SUPPORTED_VERSIONS: readonly unknown[] = [1, 2, 3];

/** Throws a {@link SnapshotShapeError} unless `json` has the shape every reader of a snapshot relies on, in a
 *  version this reader supports. */
export function assertSnapshotShape(json: unknown): void {
  const refuse = (what: string): never => {
    throw new SnapshotShapeError(`Scene: malformed snapshot: ${what}`);
  };
  if (!isPlainObject(json)) refuse('not an object');
  const { systemLayers, nodes, doc, version } = json as Record<string, unknown>;
  if (!SUPPORTED_VERSIONS.includes(version)) refuse(`unsupported version ${String(version)}; versions 1, 2 and 3 are supported`);
  if (!Array.isArray(systemLayers)) refuse('`systemLayers` is not an array');
  (systemLayers as unknown[]).forEach((layer, i) => {
    if (!isPlainObject(layer) || typeof layer.id !== 'string') refuse(`layer ${i} has no string \`id\``);
  });
  if (!Array.isArray(nodes)) refuse('`nodes` is not an array');
  if (doc !== undefined && !isPlainObject(doc)) refuse('`doc` is not an object');
  // Version 1 reads any kind but `leaf` as a group, or as its classifier says, so only later versions name theirs.
  const kinds = version === 1 ? null : NODE_KINDS;
  (nodes as unknown[]).forEach((n, i) => {
    const fault = nodeShapeFault(n, kinds);
    if (fault) refuse(isPlainObject(n) && typeof n.id === 'string' ? `node "${n.id}" ${fault}` : `node ${i} ${fault}`);
  });
}

const NODE_KINDS: readonly string[] = ['mark', 'group'];

/** What is wrong with `n` as a saved node, as a phrase after its name, or `null` when every reader of one can read it.
 *  `kinds` are the kinds it may have; `null` takes any. A clipboard item is a saved node too. */
export function nodeShapeFault(n: unknown, kinds: readonly string[] | null = NODE_KINDS): string | null {
  if (!isPlainObject(n)) return 'is not an object';
  if (typeof n.id !== 'string') return 'has no string `id`';
  if (kinds && !kinds.includes(n.kind as string)) return `has kind ${JSON.stringify(n.kind)}; expected ${kinds.join(' or ')}`;
  if (typeof n.layer !== 'string') return 'has no string `layer`';
  if (n.pose === undefined || n.pose === null) return 'has no `pose`';
  if (n.parent !== undefined && n.parent !== null && typeof n.parent !== 'string') return 'has a `parent` that is not an id';
  const deps = n.dependsOn;
  if (deps !== undefined && deps !== 'children' && !(Array.isArray(deps) && deps.every((d) => typeof d === 'string'))) {
    return "has a `dependsOn` that is neither 'children' nor a list of ids";
  }
  for (const flag of ['pickable', 'hidden', 'locked', 'consumesChildren'] as const) {
    if (n[flag] !== undefined && typeof n[flag] !== 'boolean') return `has a \`${flag}\` that is not a boolean`;
  }
  for (const { jsonKey } of NODE_FN_FIELDS) {
    if (n[jsonKey] !== undefined && typeof n[jsonKey] !== 'string') return `has a \`${jsonKey}\` that is not a string`;
  }
  return null;
}
