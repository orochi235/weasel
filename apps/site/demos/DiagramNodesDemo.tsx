import { useMemo, useState } from 'react';
import { DiagramView, diagramScene, type DataEdge, type DataNode, type NodeMove } from '@weasel-js/diagram';
import { FONT, PORTS, moved } from './diagram/shared';

const W = 640, H = 360;

/** One per outline in the vocabulary, plus the row kinds a body can carry. */
const NODES: DataNode[] = [
  { id: 'start', at: { x: 40, y: 40 }, width: 150, height: 56, outline: 'stadium', lines: ['start'] },
  { id: 'check', at: { x: 250, y: 30 }, width: 170, height: 90, outline: 'diamond', lines: ['ready?'] },
  {
    id: 'scale',
    at: { x: 60, y: 180 },
    width: 150,
    rows: [
      { kind: 'label', text: 'scale', style: { bold: true } },
      { kind: 'ports', left: [{ id: 'in', label: 'in' }], right: [{ id: 'out', label: 'out' }], height: 24 },
      { kind: 'ports', left: [{ id: 'by', label: 'by' }], height: 24 },
      { kind: 'field', label: 'mode', value: 'bilinear' },
    ],
  },
  { id: 'load', at: { x: 300, y: 200 }, width: 170, height: 50, outline: 'parallelogram', lines: ['read frame'] },
];

export function DiagramNodesDemo() {
  const [nodes, setNodes] = useState(NODES);
  const [edges, setEdges] = useState<DataEdge[]>([]);
  // The data owns the diagram. A drag and a connect each report what they
  // describe, and the view shows it once the data says so.
  const specs = useMemo(() => diagramScene({ nodes, edges }, { layout: 'none', font: FONT }), [nodes, edges]);
  return (
    <DiagramView
      specs={specs}
      width={W}
      height={H}
      className="ckd-canvas"
      portOptions={PORTS}
      onMove={(moves: readonly NodeMove[]) => setNodes((ns) => moved(ns, moves))}
      onConnect={(edge) => setEdges((es) => [...es, edge])}
    />
  );
}
