import { useMemo, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { isPrefLeaf, type PrefGroup } from '@weasel-js/prefs';
import { Button } from '../Button';
import { Tree, type TreeNode } from '../Tree';
import { PrefKindBadge } from '../Prefs/PrefKindBadge';
import { AddNodeDialog, type NewNode } from './AddNodeDialog';
import { PaneHeader } from './PaneHeader';
import { ResizeHandle } from '../ResizeHandle';
import { StoredList } from './StoredList';
import { blankGroup, blankLeaf } from './kindSchemas';
import {
  addNode, childrenOf, joinPath, keyOf, kindOfValue, moveNodes, nodeAt, parentPath, rebasePaths, removeNode, undescribedValues,
  type SchemaNode, type UndescribedValue,
} from './schemaEdit';
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
      trailing: <PrefKindBadge kind={isPrefLeaf(child) ? child.kind : 'group'} />,
      className: changed.has(p) ? s.changed : undefined,
      ...(kids ? { children: toTreeNodes(child, p, changed) } : {}),
    };
  });
}

export interface StructurePaneProps {
  schema: PrefGroup;
  onChange(next: PrefGroup): void;
  selected: string | null;
  onSelect(path: string | null): void;
  changed: ReadonlySet<string>;
  kinds: readonly string[];
  expanded: ReadonlySet<string>;
  onExpandedChange: Dispatch<SetStateAction<Set<string>>>;
  /** Controls for the whole editor, set beside the pane's own. */
  tools?: ReactNode;
  /** The values the app stores under the schema; those no leaf describes are listed under the tree. */
  stored?: unknown;
}

/** Every path above `path`, nearest last. */
const ancestorsOf = (path: string): string[] =>
  path.split('.').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('.'));

/** `'gridVisible'` as `'Grid visible'`. */
const nameOfKey = (key: string): string => {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export function StructurePane({ schema, onChange, selected, onSelect, changed, kinds, expanded, onExpandedChange, tools, stored }: StructurePaneProps) {
  const nodes = useMemo(() => toTreeNodes(schema, null, changed), [schema, changed]);
  const [adding, setAdding] = useState<'pref' | 'group' | null>(null);
  const [fromStored, setFromStored] = useState<UndescribedValue | null>(null);
  const [storedHeight, setStoredHeight] = useState(180);
  const undescribed = useMemo(() => (stored === undefined ? [] : undescribedValues(schema, stored)), [schema, stored]);
  const storedParent = fromStored && fromStored.path.includes('.') ? fromStored.path.slice(0, fromStored.path.lastIndexOf('.')) : null;

  /** Where an add lands: inside the selection if it holds children, else after it. */
  const addTarget = (): { parent: string | null; index?: number } => {
    if (selected === null || !nodeAt(schema, selected)) return { parent: null };
    if (childrenOf(nodeAt(schema, selected)!)) return { parent: selected };
    const parent = parentPath(selected);
    const sibs = Object.keys(childrenOf(nodeAt(schema, parent)!) ?? {});
    return { parent, index: sibs.indexOf(keyOf(selected)) + 1 };
  };
  const add = ({ key, name, kind }: NewNode) => {
    const node: SchemaNode = kind !== undefined ? { ...blankLeaf(kind), name } : { ...blankGroup(), name };
    setAdding(null);
    if (fromStored) {
      // A stored value's leaf goes where the value lives, making any group its path passes through.
      setFromStored(null);
      let root = schema;
      let at: string | null = null;
      for (const segment of storedParent?.split('.') ?? []) {
        const next = joinPath(at, segment);
        if (!nodeAt(root, next)) root = addNode(root, at, segment, { ...blankGroup(), name: nameOfKey(segment) });
        at = next;
      }
      onChange(addNode(root, at, key, { ...node, default: fromStored.value } as SchemaNode));
      onExpandedChange((e) => new Set([...e, ...ancestorsOf(joinPath(at, key))]));
      onSelect(joinPath(at, key));
      return;
    }
    const { parent, index } = addTarget();
    onChange(addNode(schema, parent, key, node, index));
    if (parent !== null) onExpandedChange((e) => new Set(e).add(parent));
    onSelect(joinPath(parent, key));
  };

  return (
    <section className={`${s.pane} ${s.structurePane}`} aria-label="Structure">
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
      <AddNodeDialog what={adding} kinds={kinds} onAdd={add}
        siblings={fromStored ? (nodeAt(schema, storedParent) ? childrenOf(nodeAt(schema, storedParent)!) ?? {} : {})
          : childrenOf(nodeAt(schema, addTarget().parent)!) ?? {}}
        initial={fromStored ? {
          key: fromStored.path.slice(fromStored.path.lastIndexOf('.') + 1),
          name: nameOfKey(fromStored.path.slice(fromStored.path.lastIndexOf('.') + 1)),
          ...(kindOfValue(fromStored.value) ? { kind: kindOfValue(fromStored.value)! } : {}),
        } : undefined}
        onClose={() => { setAdding(null); setFromStored(null); }} />
      <div className={s.treeArea}>
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
      </div>
      {stored !== undefined && (
        <>
          <ResizeHandle orientation="horizontal" invert value={storedHeight} min={60} max={600}
            onInput={setStoredHeight} ariaLabel="Resize stored values" />
          <div className={s.storedArea} style={{ '--stored-h': `${storedHeight}px` } as CSSProperties}>
            <PaneHeader title="Stored, not in the schema" />
            <StoredList entries={undescribed} onPick={(entry) => { setFromStored(entry); setAdding('pref'); }} />
          </div>
        </>
      )}
    </section>
  );
}
