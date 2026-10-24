import { useMemo, type ReactNode } from 'react';
import { Badge } from '../Badge';
import { conditionProblems } from './conditionMarks';
import { deadActionPaths, type EditorAction } from './editorActions';
import { isPrefLeaf, type PrefAlias } from '@weasel-js/prefs';
import { deadPointers, pointerTarget } from './pointers';
import { joinPath, keyClashes, keysOf, nodeAt, type SchemaRoot } from './schemaEdit';
import { baselinePaths, type SchemaChange } from './schemaExport';

const NO_PATHS: ReadonlySet<string> = new Set();

/**
 * What the structure tree draws on a row before its kind: the editor's own marks for a node that is wired to
 * nothing, then the host's. `undefined` while there is nothing to draw on any row.
 */
export function useRowMarks({ schema, over, changes, actions, rowMark }: {
  schema: SchemaRoot;
  /** The dialog a layout's pointers name settings in. */
  over?: SchemaRoot;
  /** The schema's changes from its baseline, which say where each node sat there. */
  changes: readonly SchemaChange[];
  /** The actions a pref may fire; `null` with no way to know which keys exist. */
  actions: readonly EditorAction[] | null;
  /** The host's mark, asked by a node's path in the baseline. A layout's pointer is asked about by the path of
   *  the setting it names, and its other rows are not asked about: the host's marks are its settings'. */
  rowMark?: (original: string) => ReactNode;
}): ((path: string) => ReactNode) | undefined {
  // With no list there is no telling a dead key from a live one, so nothing is marked.
  const dead = useMemo(
    () => (actions ? deadActionPaths(schema, new Set(actions.map((a) => a.key)), joinPath) : NO_PATHS),
    [actions, schema],
  );
  const lost = useMemo(() => (over ? new Set(deadPointers(schema, over)) : NO_PATHS), [schema, over]);
  const unsound = useMemo(() => conditionProblems(schema, over), [schema, over]);
  const clashing = useMemo(() => keyClashes(schema), [schema]);
  return useMemo(() => {
    if (!rowMark && dead.size === 0 && lost.size === 0 && unsound.size === 0 && clashing.size === 0) return undefined;
    const baseline = baselinePaths(changes);
    const asked = (path: string): string | undefined => {
      if (!over) return keysOf(baseline(path)).join('.');
      const node = nodeAt(schema, path);
      return node && isPrefLeaf(node) && node.kind === 'alias' ? pointerTarget(over, node as PrefAlias)?.path : undefined;
    };
    const hostMark = (path: string): ReactNode => {
      const at = rowMark ? asked(path) : undefined;
      return at === undefined ? null : rowMark!(at);
    };
    return (path: string) => (
      <>
        {dead.has(path) && <Badge size="xs" grade="danger" variant="subtle">no action</Badge>}
        {lost.has(path) && <Badge size="xs" grade="danger" variant="subtle">no setting</Badge>}
        {clashing.has(path) && <Badge size="xs" grade="danger" variant="subtle" tooltip={clashing.get(path)}>key taken</Badge>}
        {unsound.has(path) && (
          <Badge size="xs" grade="danger" variant="subtle" tooltip={unsound.get(path)!.map((p) => p.problem).join('; ')}>bad condition</Badge>
        )}
        {hostMark(path)}
      </>
    );
  }, [rowMark, changes, dead, lost, unsound, clashing, schema, over]);
}
