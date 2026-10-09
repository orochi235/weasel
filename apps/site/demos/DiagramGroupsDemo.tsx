import { useMemo, useRef, useState } from 'react';
import { DiagramView, diagramScene, type DataEdge, type DataGroup, type DataNode, type DiagramViewApi } from '@weasel-js/diagram';
import { FONT, moved } from './diagram/shared';

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

export function DiagramGroupsDemo() {
  const [nodes, setNodes] = useState(NODES);
  const specs = useMemo(() => diagramScene({ nodes, edges: EDGES, groups: GROUPS }, { font: FONT }), [nodes]);
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
      <DiagramView
        ref={view}
        specs={specs}
        width={640}
        height={400}
        className="ckd-canvas"
        onMove={(moves) => setNodes((ns) => moved(ns, moves))}
      />
    </div>
  );
}
