import { useMemo, useState } from 'react';
import {
  DiagramView, diagramScene, dragItemProps,
  type CanConnect, type CanDropItem, type CanReparent, type DataEdge, type DataNode, type DiagramData, type ItemDrop, type NodeMove,
} from '@weasel-js/diagram';
import { FONT } from './diagram/shared';
import { DemoStage } from './DemoStage';
import s from './DiagramDropDemo.module.css';

const STEP = { width: 80, height: 40 };
const ROW = { x: 40, y: 40, height: 100 };
const SHELF = { x: 40, y: 220, width: 220, height: 120 };
const PALETTE = ['step', 'note'] as const;
type Kind = (typeof PALETTE)[number];

interface State {
  /** The row's steps, left to right. */
  row: readonly string[];
  /** Everything else, where it stands; `shelf` holds the ids on the locked shelf. */
  loose: readonly DataNode[];
  shelf: readonly string[];
  edges: readonly DataEdge[];
}

const START: State = {
  row: ['decode', 'filter', 'mix'],
  loose: [
    { id: 'source', lines: ['source'], ...STEP, at: { x: 340, y: 260 }, pinned: true },
    { id: 'kept', lines: ['kept'], ...STEP, at: { x: 70, y: 270 }, pinned: true },
  ],
  shelf: ['kept'],
  edges: [{ from: 'decode', to: 'filter' }, { from: 'filter', to: 'mix' }],
};

/** The row's steps stand in their order; everything else where it was left. */
function dataOf(st: State): DiagramData {
  const rowWidth = Math.max(1, st.row.length) * 100 + 20;
  return {
    nodes: [
      ...st.row.map((id, k) => ({ id, lines: [id], ...STEP, at: { x: ROW.x + 20 + 100 * k, y: ROW.y + 44 }, pinned: true })),
      ...st.loose,
    ],
    edges: [...st.edges],
    containers: [
      { id: 'row', role: 'container', label: 'Row', members: [...st.row], reorder: 'x', box: { ...ROW, width: rowWidth }, pinned: true },
      { id: 'shelf', role: 'container', label: 'Locked shelf', members: [...st.shelf], box: SHELF, pinned: true },
    ],
  };
}

const canConnect: CanConnect = (from, to) =>
  from.nodeId === to.nodeId ? false : to.nodeId === 'source' ? { refuse: 'The source takes no inputs' } : true;
const canReparent: CanReparent = (_ids, into) => (into === 'shelf' ? { refuse: 'The shelf is locked' } : true);

let made = 0;

export function DiagramDropDemo() {
  const [st, setSt] = useState<State>(START);
  const specs = useMemo(() => diagramScene(dataOf(st), { font: FONT, layout: 'none' }), [st]);
  const canDropItem: CanDropItem = (item, t) => {
    if (t.container === 'shelf') return { refuse: 'The shelf is locked' };
    if (item === 'note' && t.container === 'row') return { refuse: 'Notes stay out of the row' };
    return true;
  };
  const onDropItem = ({ item, container, index, at }: ItemDrop) => setSt((was) => {
    const id = `${item as Kind}-${++made}`;
    if (container === 'row' && index !== null) return { ...was, row: [...was.row.slice(0, index), id, ...was.row.slice(index)] };
    const node: DataNode = { id, lines: [id], ...STEP, at: { x: at.x - STEP.width / 2, y: at.y - STEP.height / 2 }, pinned: true };
    return { ...was, loose: [...was.loose, node] };
  });
  // A step dragged out of the row stands where it was left; one dragged in joins the row's end.
  const onMove = (moves: readonly NodeMove[]) => setSt((was) => {
    const to = new Map(moves.map((m) => [m.id, m]));
    const out = (id: string) => to.has(id) && to.get(id)!.parent !== undefined && to.get(id)!.parent !== 'row';
    const into = (id: string) => to.get(id)?.parent === 'row';
    const place = (id: string): DataNode => ({ id, lines: [id], ...STEP, at: { x: to.get(id)!.x, y: to.get(id)!.y }, pinned: true });
    return {
      ...was,
      row: [...was.row.filter((id) => !out(id)), ...was.loose.filter((n) => into(n.id)).map((n) => n.id)],
      loose: [...was.loose.filter((n) => !into(n.id)).map((n) => (to.has(n.id) ? place(n.id) : n)), ...was.row.filter(out).map(place)],
      shelf: was.shelf.filter((id) => to.get(id)?.parent === undefined || to.get(id)!.parent === 'shelf'),
    };
  });
  return (
    <div className={s.demo}>
      <ul className={s.palette} aria-label="Palette">
        {PALETTE.map((kind) => <li key={kind} className={s.item} {...dragItemProps(kind)}>{kind}</li>)}
      </ul>
      <DemoStage width={640} height={380}>
        <DiagramView
          specs={specs} className="ckd-canvas" connectBodies
          onConnect={(edge) => setSt((was) => ({ ...was, edges: [...was.edges, edge] }))} canConnect={canConnect}
          onMove={onMove} canReparent={canReparent}
          onReorder={({ parent, order }) => parent === 'row' && setSt((was) => ({ ...was, row: order }))}
          onDropItem={onDropItem} canDropItem={canDropItem}
        />
      </DemoStage>
    </div>
  );
}
