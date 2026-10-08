import { useMemo, useState } from 'react';
import type { ToolPrefGroup } from '@weasel-js/core';
import { Button } from '../Button';
import { Code } from '../Code';
import { Select } from '../Select';
import { Tree, type TreeNode } from '../Tree';
import { isPrefLeaf } from '../Prefs/schema';
import { blankGroup, blankLeaf } from './kindSchemas';
import { addNode, childrenOf, joinPath, keyOf, moveNodes, nodeAt, parentPath, removeNode, uniqueKey, type SchemaNode } from './schemaEdit';
import s from './PrefSchemaEditor.module.css';

function toTreeNodes(node: SchemaNode, path: string | null, changed: ReadonlySet<string>): TreeNode[] {
  return Object.entries(childrenOf(node) ?? {}).map(([key, child]) => {
    const p = joinPath(path, key);
    const kids = childrenOf(child);
    return {
      id: p,
      label: key,
      textValue: key,
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
}

export function StructurePane({ schema, onChange, selected, onSelect, changed, kinds }: StructurePaneProps) {
  const nodes = useMemo(() => toTreeNodes(schema, null, changed), [schema, changed]);
  const [kind, setKind] = useState<string>('boolean');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(nodes.flatMap(function all(n): string[] { return n.children ? [n.id, ...n.children.flatMap(all)] : []; })));

  /** Where an add lands: inside the selection if it holds children, else after it. */
  const addTarget = (): { parent: string | null; index?: number } => {
    if (selected === null) return { parent: null };
    if (childrenOf(nodeAt(schema, selected)!)) return { parent: selected };
    const parent = parentPath(selected);
    const sibs = Object.keys(childrenOf(nodeAt(schema, parent)!) ?? {});
    return { parent, index: sibs.indexOf(keyOf(selected)) + 1 };
  };
  const add = (base: string, node: SchemaNode) => {
    const { parent, index } = addTarget();
    const key = uniqueKey(childrenOf(nodeAt(schema, parent)!) ?? {}, base);
    onChange(addNode(schema, parent, key, node, index));
    if (parent !== null) setExpanded((e) => new Set(e).add(parent));
    onSelect(joinPath(parent, key));
  };

  return (
    <section className={s.pane} aria-label="Structure">
      <div className={s.toolbar}>
        <Select aria-label="Kind to add" width="fit" selectedKey={kind} onSelectionChange={(k) => setKind(String(k))}
          options={kinds.map((k) => ({ value: k, label: k }))} />
        <Button size="sm" onClick={() => add('newPref', blankLeaf(kind))}>Add pref</Button>
        <Button size="sm" onClick={() => add('newGroup', blankGroup())}>Add group</Button>
        <Button size="sm" disabled={selected === null} onClick={() => {
          if (selected === null) return;
          onChange(removeNode(schema, selected));
          onSelect(parentPath(selected));
        }}>Remove</Button>
      </div>
      <Tree
        aria-label="Schema structure"
        nodes={nodes}
        expandedIds={expanded}
        onExpandedChange={setExpanded}
        selectionMode="single"
        selectedIds={selected === null ? [] : [selected]}
        onSelectionChange={(ids) => onSelect([...ids][0] ?? null)}
        canDrop={(_ids, t) => t.parentId === null || !!childrenOf(nodeAt(schema, t.parentId)!)}
        onMove={(ids, t) => {
          const moved = moveNodes(schema, ids, { parentPath: t.parentId, index: t.index });
          onChange(moved.root);
          onSelect(moved.paths[0] ?? null);
        }}
      />
    </section>
  );
}
