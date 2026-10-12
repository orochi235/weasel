import { useMemo } from 'react';
import { isPrefLeaf, type PrefLeaf } from '@weasel-js/prefs';
import { prefFieldChoices } from '../Prefs/schema';
import { aliasChoices } from './aliasChoices';
import { nodeAt, valuePathsAt, type SchemaNode, type SchemaRoot } from './schemaEdit';

/** The nodes at `targets` in `schema`, and what a reference set on them may name. */
export function useSelectedNodes(schema: SchemaRoot, targets: ReadonlyArray<string | null>, over: SchemaRoot | undefined) {
  const nodes = useMemo(
    () => targets.map((p) => nodeAt(schema, p)).filter((n): n is SchemaNode => n !== undefined),
    [schema, targets],
  );
  // What the selected nodes hold themselves, which none of them is shown or enabled by.
  const ownPaths = useMemo(() => targets.flatMap((p, i) => (nodes[i] ? valuePathsAt(schema, p, nodes[i]) : [])), [schema, targets, nodes]);
  // The fields of the schema a reference names into, by its own path rule: a layout's pointers name its dialog's.
  const fields = useMemo(() => {
    const all = prefFieldChoices(over ?? schema);
    const aliases = nodes.filter((n): n is PrefLeaf => isPrefLeaf(n) && n.kind === 'alias');
    return aliases.length > 0 && aliases.length === nodes.length ? aliasChoices(over ?? schema, aliases, all) : all;
  }, [schema, over, nodes]);
  return { nodes, ownPaths, fields };
}
