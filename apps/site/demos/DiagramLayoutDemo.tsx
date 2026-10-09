import { useMemo, useRef, useState } from 'react';
import { DiagramView, diagramScene, type DataEdge, type DataNode, type DiagramViewApi } from '@weasel-js/diagram';
import { FONT, moved } from './diagram/shared';

const W = 640, H = 360;
const BOX = { width: 140, height: 44 };
/** Tighter than the layout defaults, and force turned down to match: the
 *  shipped numbers are sized for a page, not for 640×360. */
const LIVE = {
  layout: { nodeGap: 32, rankGap: 40 },
  force: { linkDistance: 80, charge: -400, gravity: 0.08, padding: 16 },
};
const CHOICES = ['layered', 'tree', 'force'] as const;

/** Deliberately scattered, and deliberately not in graph order: a layout has
 *  to read where things are, not just how they connect. */
const NODES: DataNode[] = [
  { id: 'read', at: { x: 380, y: 40 }, ...BOX, lines: ['read'] },
  { id: 'parse', at: { x: 60, y: 150 }, ...BOX, lines: ['parse'] },
  { id: 'scale', at: { x: 420, y: 200 }, ...BOX, lines: ['scale'] },
  { id: 'write', at: { x: 150, y: 280 }, ...BOX, lines: ['write'] },
];
// A diamond rather than a chain: two nodes share a rank, which is what makes
// within-rank order — and the layouts' differences — visible at all.
const EDGES: DataEdge[] = [
  { from: 'read', to: 'parse' }, { from: 'read', to: 'scale' },
  { from: 'parse', to: 'write' }, { from: 'scale', to: 'write' },
].map((e) => ({ ...e, router: 'orthogonal' }));

export function DiagramLayoutDemo() {
  const [nodes, setNodes] = useState(NODES);
  const specs = useMemo(() => diagramScene({ nodes, edges: EDGES }, { layout: 'none', font: FONT }), [nodes]);
  const view = useRef<DiagramViewApi>(null);
  return (
    <div className="ckd-stack">
      <div className="ckd-row">
        {CHOICES.map((name) => (
          <button key={name} type="button" className="ckd-btn" onClick={() => view.current?.layout(name)}>
            {name}
          </button>
        ))}
      </div>
      <DiagramView
        ref={view}
        specs={specs}
        width={W}
        height={H}
        className="ckd-canvas"
        live={LIVE}
        onMove={(moves) => setNodes((ns) => moved(ns, moves))}
      />
    </div>
  );
}
