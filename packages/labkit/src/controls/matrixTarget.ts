import { isPrefLeaf, type PrefAlias, type PrefAliasTargets, type PrefLeaf } from '@weasel-js/prefs';
import { schemaNodeAtPath } from '../config/path';
import type { ResolvedConfig } from '../config/types';

/** What one cell of a `ControlMatrix` shows. */
export interface MatrixTarget {
  /** The schema's own leaf at the cell's path. */
  node: PrefLeaf;
  /** The leaf the cell draws: `node`, or the leaf an alias points at. */
  leaf: PrefLeaf;
  /** The path the cell's value is read and written at. */
  at: string;
  /** The value is the cell's own, so it can inherit. An alias's is another setting's. */
  own: boolean;
}

/**
 * The cell at `path`, or `undefined` where the schema holds no leaf there. An
 * alias shows the leaf of `targets` it points at, at that leaf's path; an
 * alias of nothing keeps its own, which holds no value.
 */
export function matrixTargetAt(
  schema: ResolvedConfig,
  path: string,
  targets: PrefAliasTargets,
): MatrixTarget | undefined {
  const node = schemaNodeAtPath(schema.group, path);
  if (!node || !isPrefLeaf(node)) return undefined;
  if (node.kind !== 'alias') return { node, leaf: node, at: path, own: true };
  const shown = targets.shown(node as PrefAlias);
  return { node, leaf: shown?.leaf ?? node, at: shown?.path ?? path, own: false };
}
