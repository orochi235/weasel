import { useMemo, useRef, useState } from 'react';
import { DiagramView, diagramScene, type DataEdge, type DataNode, type DiagramViewApi } from '@weasel-js/diagram';
import { FONT, moved } from './diagram/shared';

const W = 640, H = 360;
const BOX = { width: 96, height: 32 };

/** A hub and two clusters — enough that a drag on one side visibly reaches the
 *  other. Starting positions are a rough ring, so the first frames are a
 *  relaxation rather than an explosion. */
const NODES: DataNode[] = ([
  ['hub', 300, 160], ['api', 150, 70], ['db', 150, 250], ['auth', 60, 160],
  ['ui', 460, 70], ['cdn', 520, 160], ['log', 460, 250],
] as const).map(([id, x, y]) => ({ id, at: { x, y }, ...BOX, lines: [id] }));
const EDGES: DataEdge[] = [
  { from: 'hub', to: 'api' }, { from: 'hub', to: 'db' }, { from: 'hub', to: 'ui' }, { from: 'hub', to: 'log' },
  { from: 'api', to: 'auth' }, { from: 'db', to: 'auth' }, { from: 'ui', to: 'cdn' }, { from: 'log', to: 'cdn' },
];
const UNDIRECTED = () => ({ stroke: '#7ba7c7', width: 2, markerEnd: null });

export function DiagramLiveDemo() {
  const [nodes, setNodes] = useState(NODES);
  const specs = useMemo(
    () => diagramScene({ nodes, edges: EDGES }, { layout: 'none', font: FONT, edgeStyle: UNDIRECTED }),
    [nodes],
  );
  const view = useRef<DiagramViewApi>(null);
  const [running, setRunning] = useState(false);
  // Sized for 640×360 rather than for a page.
  const live = useMemo(() => ({
    force: { linkDistance: 90, charge: -900, gravity: 0.06, padding: 14 },
    onSettle: () => setRunning(false),
  }), []);
  return (
    <div className="ckd-stack">
      <div className="ckd-row">
        <button
          type="button"
          className="ckd-btn"
          onClick={() => {
            if (running) view.current?.live.stop();
            else view.current?.layout('force');
            setRunning(!running);
          }}
        >
          {running ? 'Settle now' : 'Relax'}
        </button>
        <button type="button" className="ckd-btn" onClick={() => { view.current?.layout('force'); setRunning(true); }}>
          Shake
        </button>
      </div>
      <DiagramView
        ref={view}
        specs={specs}
        width={W}
        height={H}
        className="ckd-canvas"
        live={live}
        onMove={(moves) => setNodes((ns) => moved(ns, moves))}
      />
    </div>
  );
}
