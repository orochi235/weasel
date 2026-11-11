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

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Throws a {@link SnapshotShapeError} unless `json` has the shape every reader of a snapshot relies on. The
 *  version is not checked here: an unsupported one has its own refusal. */
export function assertSnapshotShape(json: unknown): void {
  const refuse = (what: string): never => {
    throw new SnapshotShapeError(`Scene: malformed snapshot: ${what}`);
  };
  if (!isRecord(json)) refuse('not an object');
  const { systemLayers, nodes, doc, version } = json as Record<string, unknown>;
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
