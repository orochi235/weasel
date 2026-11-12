/**
 * The shape a snapshot must have before anything reads it. A snapshot is JSON from a file or the wire, so it is
 * checked here and refused with a `SnapshotShapeError` naming what is wrong, rather than half read until some
 * field turns out not to be there.
 */
import { NODE_FN_FIELDS } from './nodeFnFields';

/** A snapshot that is not shaped as `toJSON()` writes one: what is wrong, and where. */
export class SnapshotShapeError extends Error {
  override name = 'SnapshotShapeError';
}

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

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Throws a {@link SnapshotShapeError} unless `json` has the shape every reader of a snapshot relies on, in a
 *  version this reader supports. */
export function assertSnapshotShape(json: unknown): void {
  const refuse = (what: string): never => {
    throw new SnapshotShapeError(`Scene: malformed snapshot: ${what}`);
  };
  if (!isRecord(json)) refuse('not an object');
  const { systemLayers, nodes, doc, version } = json as Record<string, unknown>;
  if (!SUPPORTED_VERSIONS.includes(version)) refuse(`unsupported version ${String(version)}; versions 1, 2 and 3 are supported`);
  if (!Array.isArray(systemLayers)) refuse('`systemLayers` is not an array');
  (systemLayers as unknown[]).forEach((layer, i) => {
    if (!isRecord(layer) || typeof layer.id !== 'string') refuse(`layer ${i} has no string \`id\``);
  });
  if (!Array.isArray(nodes)) refuse('`nodes` is not an array');
  if (doc !== undefined && !isRecord(doc)) refuse('`doc` is not an object');
  // Version 1 reads any kind but `leaf` as a group, or as its classifier says, so only later versions name theirs.
  const kinds = version === 1 ? null : ['mark', 'group'];
  (nodes as unknown[]).forEach((n, i) => {
    if (!isRecord(n)) return refuse(`node ${i} is not an object`);
    if (typeof n.id !== 'string') refuse(`node ${i} has no string \`id\``);
    const at = `node "${n.id as string}"`;
    if (kinds && !kinds.includes(n.kind as string)) refuse(`${at} has kind ${JSON.stringify(n.kind)}; expected ${kinds.join(' or ')}`);
    if (typeof n.layer !== 'string') refuse(`${at} has no string \`layer\``);
    if (n.pose === undefined || n.pose === null) refuse(`${at} has no \`pose\``);
    if (n.parent !== undefined && n.parent !== null && typeof n.parent !== 'string') refuse(`${at} has a \`parent\` that is not an id`);
    const deps = n.dependsOn;
    if (deps !== undefined && deps !== 'children' && !(Array.isArray(deps) && deps.every((d) => typeof d === 'string'))) {
      refuse(`${at} has a \`dependsOn\` that is neither 'children' nor a list of ids`);
    }
    for (const flag of ['pickable', 'hidden', 'locked', 'consumesChildren'] as const) {
      if (n[flag] !== undefined && typeof n[flag] !== 'boolean') refuse(`${at} has a \`${flag}\` that is not a boolean`);
    }
    for (const { jsonKey } of NODE_FN_FIELDS) {
      if (n[jsonKey] !== undefined && typeof n[jsonKey] !== 'string') refuse(`${at} has a \`${jsonKey}\` that is not a string`);
    }
  });
}
