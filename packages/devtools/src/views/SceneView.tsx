/** The Scene tab: a root's node tree beside the node picked in it. */
import { useRef, useState, type PointerEvent, type ReactElement } from 'react';
import type { DevtoolsNodeSummary } from '@weasel-js/core/devtools-protocol';
import { Tree, type TreeNode } from '@weasel-js/ui/components/Tree';
import type { DevtoolsViewProps } from '../tabs';
import { NodeDetail } from './NodeDetail';
import { useSceneTree } from './useSceneTree';
import s from './SceneView.module.css';

function flags(row: DevtoolsNodeSummary): string[] {
  return [row.hidden && 'hidden', row.locked && 'locked', !row.pickable && 'unpickable'].filter(
    (f): f is string => typeof f === 'string',
  );
}

function RowFacts({ row }: { row: DevtoolsNodeSummary }): ReactElement {
  return (
    <span className={s.facts}>
      <span className={s.kind}>{row.kind}</span>
      <span className={s.layer}>{row.layer}</span>
      {row.kind === 'group' && <span className={s.count}>{row.childCount}</span>}
      {flags(row).map((f) => <span key={f} className={s.flag}>{f}</span>)}
    </span>
  );
}

function toNodes(levels: ReadonlyMap<string, readonly DevtoolsNodeSummary[]>, parent: string): TreeNode[] {
  return (levels.get(parent) ?? []).map((row) => ({
    id: row.id,
    textValue: row.id,
    label: <span data-node-id={row.id}>{row.id}</span>,
    trailing: <RowFacts row={row} />,
    muted: row.hidden,
    ...(row.kind === 'group' && row.childCount > 0 ? { children: toNodes(levels, row.id) } : {}),
  }));
}

export function SceneView({ client, rootId }: DevtoolsViewProps): ReactElement {
  const tree = useSceneTree(client, rootId);
  const [selected, setSelected] = useState<string | null>(null);
  const hovered = useRef<string | null>(null);

  const highlight = (id: string | null): void => {
    if (hovered.current === id) return;
    hovered.current = id;
    client.request(rootId, { type: 'highlight', ids: id ? [id] : [] }).catch(() => {});
  };
  const onPointerOver = (e: PointerEvent<HTMLDivElement>): void => {
    const row = (e.target as Element).closest('[role="treeitem"]');
    highlight(row?.querySelector('[data-node-id]')?.getAttribute('data-node-id') ?? null);
  };

  return (
    <div className={s.split}>
      <div className={s.treePane} data-pane="tree" onPointerOver={onPointerOver} onPointerLeave={() => highlight(null)}>
        <Tree
          aria-label="Scene nodes"
          nodes={toNodes(tree.levels, '')}
          empty={<p className={s.note}>{tree.error ?? 'The scene is empty.'}</p>}
          expandedIds={tree.expanded}
          onExpandedChange={tree.setExpanded}
          selectionMode="single"
          selectedIds={selected ? [selected] : []}
          onSelectionChange={(ids) => setSelected(ids.values().next().value ?? null)}
        />
      </div>
      <div className={s.detailPane} data-pane="detail">
        {selected
          ? <NodeDetail key={selected} client={client} rootId={rootId} nodeId={selected} onPick={setSelected} />
          : <p className={s.note}>Pick a node to see its pose and data.</p>}
      </div>
    </div>
  );
}
