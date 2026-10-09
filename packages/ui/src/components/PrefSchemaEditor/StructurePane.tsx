import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { ToolPrefGroup } from '@weasel-js/core';
import { Button } from '../Button';
import { Code } from '../Code';
import { Tree, type TreeNode } from '../Tree';
import { isPrefLeaf } from '../Prefs/schema';
import { AddNodeDialog, type NewNode } from './AddNodeDialog';
import { PaneHeader } from './PaneHeader';
import { blankGroup, blankLeaf } from './kindSchemas';
import { addNode, childrenOf, joinPath, keyOf, moveNodes, nodeAt, parentPath, rebasePaths, removeNode, type SchemaNode } from './schemaEdit';
import s from './PrefSchemaEditor.module.css';

function toTreeNodes(node: SchemaNode, path: string | null, changed: ReadonlySet<string>): TreeNode[] {
  return Object.entries(childrenOf(node) ?? {}).map(([key, child]) => {
    const p = joinPath(path, key);
    const kids = childrenOf(child);
    const { name } = child;
    return {
      id: p,
      label: name ? <>{name} <span className={s.treeKey}>({key})</span></> : key,
      textValue: name ? `${name} ${key}` : key,
      trailing: <Code size="xs" status="muted" variant="plain">{isPrefLeaf(child) ? child.kind : 'group'}</Code>,
      className: changed.has(p) ? s.changed : undefined,
      ...(kids ? { children: toTreeNodes(child, p, changed) } : {}),
    };
  });
}

export interface StructurePaneProps {
  schema: ToolPrefGroup;
  onChange(next: ToolPrefGroup): void;
  selected: string | null;
  onSelect(path: string | null): void;
  changed: ReadonlySet<string>;
  kinds: readonly string[];
  expanded: ReadonlySet<string>;
  onExpandedChange: Dispatch<SetStateAction<Set<string>>>;
  /** Controls for the whole editor, set beside the pane's own. */
  tools?: ReactNode;
}

export function StructurePane({ schema, onChange, selected, onSelect, changed, kinds, expanded, onExpandedChange, tools }: StructurePaneProps) {
  const nodes = useMemo(() => toTreeNodes(schema, null, changed), [schema, changed]);
  const [adding, setAdding] = useState<'pref' | 'group' | null>(null);

  /** Where an add lands: inside the selection if it holds children, else after it. */
  const addTarget = (): { parent: string | null; index?: number } => {
    if (selected === null || !nodeAt(schema, selected)) return { parent: null };
    if (childrenOf(nodeAt(schema, selected)!)) return { parent: selected };
    const parent = parentPath(selected);
    const sibs = Object.keys(childrenOf(nodeAt(schema, parent)!) ?? {});
    return { parent, index: sibs.indexOf(keyOf(selected)) + 1 };
  };
  const add = ({ key, name, kind }: NewNode) => {
    const { parent, index } = addTarget();
    const node: SchemaNode = kind !== undefined ? { ...blankLeaf(kind), name } : { ...blankGroup(), name };
    setAdding(null);
    onChange(addNode(schema, parent, key, node, index));
    if (parent !== null) onExpandedChange((e) => new Set(e).add(parent));
    onSelect(joinPath(parent, key));
  };

  return (
    <section className={s.pane} aria-label="Structure">
      <PaneHeader title="Structure">{tools}</PaneHeader>
      <div className={s.toolbar}>
        <Button size="sm" onClick={() => setAdding('pref')}>Add pref</Button>
        <Button size="sm" onClick={() => setAdding('group')}>Add group</Button>
        <Button size="sm" disabled={selected === null} onClick={() => {
          if (selected === null) return;
          onChange(removeNode(schema, selected));
          onSelect(parentPath(selected));
        }}>Remove</Button>
      </div>
      <AddNodeDialog what={adding} siblings={childrenOf(nodeAt(schema, addTarget().parent)!) ?? {}} kinds={kinds}
        onAdd={add} onClose={() => setAdding(null)} />
      <Tree
        aria-label="Schema structure"
        nodes={nodes}
        expandedIds={expanded}
        onExpandedChange={onExpandedChange}
        selectionMode="single"
        selectedIds={selected === null ? [] : [selected]}
        onSelectionChange={(ids) => onSelect([...ids][0] ?? null)}
        canDrop={(_ids, t) => t.parentId === null || !!childrenOf(nodeAt(schema, t.parentId)!)}
        onMove={(ids, t) => {
          const moved = moveNodes(schema, ids, { parentPath: t.parentId, index: t.index });
          onChange(moved.root);
          onExpandedChange((e) => rebasePaths(e, moved.from.map((f, i) => [f, moved.paths[i]!] as const)));
          onSelect(moved.paths[0] ?? null);
        }}
      />
    </section>
  );
}
