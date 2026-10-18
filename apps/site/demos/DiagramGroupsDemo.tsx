import { useMemo, useRef, useState } from 'react';
import { DiagramView, diagramScene, type DataEdge, type DataGroup, type DataNode, type DiagramViewApi } from '@weasel-js/diagram';
import { FONT, moved, routed } from './diagram/shared';
import { DemoStage } from './DemoStage';

/** Two subsystems that feed each other at every stage, so without groups
 *  their stages would interleave rank by rank. */
const NODES: DataNode[] = ['fetch', 'decode', 'cache', 'probe', 'score', 'report', 'clock']
  .map((id) => ({ id, lines: [id] }));
const EDGES: DataEdge[] = [
  { from: 'fetch', to: 'decode' }, { from: 'decode', to: 'cache' },
  { from: 'probe', to: 'score' }, { from: 'score', to: 'report' },
  { from: 'fetch', to: 'score' }, { from: 'probe', to: 'decode' },
  // An edge naming a group meets its box, and ranks against its first stage.
  { from: 'clock', to: 'ingest' },
];
const GROUPS: DataGroup[] = [
  { id: 'ingest', members: ['fetch', 'decode', 'cache'], label: 'ingest' },
  { id: 'health', members: ['probe', 'score', 'report'], label: 'health' },
];



/** The nodes where the layered layout puts them. Laid out once: a layout in
 *  `groupSpecs` would run again on every drag and take the drag back. */
export const START: DataNode[] = (() => {
  const laidOut = diagramScene({ nodes: NODES, edges: EDGES, groups: GROUPS }, { font: FONT });
  return NODES.map((n) => {
    const { x, y } = laidOut.find((s) => s.id === n.id)!.pose;
    return { ...n, at: { x, y } };
  });
})();

export function groupSpecs(nodes: readonly DataNode[], edges: readonly DataEdge[] = EDGES) {
  return diagramScene({ nodes: [...nodes], edges: [...edges], groups: GROUPS }, { layout: 'none', font: FONT });
}

export function DiagramGroupsDemo() {
  const [nodes, setNodes] = useState(START);
  const [edges, setEdges] = useState(EDGES);
  const specs = useMemo(() => groupSpecs(nodes, edges), [nodes, edges]);
  const view = useRef<DiagramViewApi>(null);
  return (
    <div className="ckd-stack">
      <div className="ckd-row">
        {(['layered', 'tree'] as const).map((name) => (
          <button key={name} type="button" className="ckd-btn" onClick={() => view.current?.layout(name)}>
            {name}
          </button>
        ))}
      </div>
      <DemoStage width={640} height={400}>
        <DiagramView
          ref={view}
          specs={specs}
          className="ckd-canvas"
          onMove={(moves, routes) => {
            setNodes((ns) => moved(ns, moves));
            setEdges((es) => routed(es, routes));
          }}
        />
      </DemoStage>
    </div>
  );
}
