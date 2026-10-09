import { useMemo, useState } from 'react';
import { DiagramView, diagramScene, type DataEdge, type DataNode } from '@weasel-js/diagram';
import { FONT, moved } from './diagram/shared';

const W = 640, H = 360;
const BOX = { width: 150, height: 44 };

/** One pair per router, offset on both axes so the three shapes are told
 *  apart by the path rather than by the label. */
const PAIRS = [
  { router: 'straight', y: 24, at: 'start' },
  { router: 'orthogonal', y: 136, at: 'mid' },
  { router: 'bezier', y: 248, at: 'end' },
] as const;

const NODES: DataNode[] = PAIRS.flatMap(({ router, y }) => [
  { id: `${router}-from`, at: { x: 40, y }, ...BOX, lines: [router] },
  { id: `${router}-to`, at: { x: 400, y: y + 40 }, ...BOX, lines: ['to'] },
]);
const EDGES: DataEdge[] = PAIRS.map(({ router, at }) => ({
  from: `${router}-from`,
  to: `${router}-to`,
  router,
  label: at,
  labelPlacement: { at, offset: 11 },
}));

export function DiagramEdgesDemo() {
  const [nodes, setNodes] = useState(NODES);
  const specs = useMemo(() => diagramScene({ nodes, edges: EDGES }, { layout: 'none', font: FONT }), [nodes]);
  return (
    <DiagramView
      specs={specs}
      width={W}
      height={H}
      className="ckd-canvas"
      onMove={(moves) => setNodes((ns) => moved(ns, moves))}
    />
  );
}
