import { useMemo, useRef, useState } from 'react';
import {
  DiagramView,
  diagramScene,
  type DataEdge,
  type DataGroup,
  type DataNode,
  type DiagramLayout,
  type DiagramViewApi,
} from '@weasel-js/diagram';
import { elkPlanner } from '@weasel-js/diagram-elk';
import { Button } from '@weasel-js/ui/components/Button';
import { FONT, moved, PORTS, routed } from './diagram/shared';
import { DemoStage } from './DemoStage';

const BOX = { width: 72, height: 32 };
const LIVE = { layout: { nodeGap: 24, rankGap: 32 } };

/** ELK loads the first time one of these runs, and answers later; the view
 *  eases to its answer as it does to `layered`'s. */
const CHOICES: [string, DiagramLayout][] = [
  ['layered', 'layered'],
  ['elk', elkPlanner()],
  ['elk right', elkPlanner({ direction: 'right' })],
];

/** Scattered, so every layout has somewhere to go. `check` takes its input on
 *  top and leaves by one of two ports, and ELK keeps each wire on its port's side. */
const NODES: DataNode[] = [
  { id: 'source', at: { x: 400, y: 10 } },
  { id: 'parse', at: { x: 40, y: 60 } },
  {
    id: 'check', at: { x: 240, y: 130 },
    ports: [{ id: 'in', at: { u: 0.5, v: 0 } }, { id: 'ok', at: { u: 0.5, v: 1 } }, { id: 'err', at: { u: 1, v: 0.5 } }],
  },
  { id: 'fold', at: { x: 60, y: 230 } },
  { id: 'emit', at: { x: 300, y: 300 } },
  { id: 'report', at: { x: 470, y: 180 } },
].map((n) => ({ ...BOX, lines: [n.id], ...n }));

const EDGES: DataEdge[] = [
  { from: 'source', to: 'parse', label: 'text' },
  { from: 'parse', to: 'check', toPort: 'in', label: 'tree' },
  { from: 'check', fromPort: 'ok', to: 'fold', label: 'typed' },
  { from: 'check', fromPort: 'err', to: 'report', label: 'errors' },
  { from: 'fold', to: 'emit' },
].map((e) => ({ ...e, router: 'orthogonal' }));

/** `middle` sits inside `compiler`. */
const GROUPS: DataGroup[] = [
  { id: 'compiler', members: ['parse', 'middle', 'emit'], label: 'compiler' },
  { id: 'middle', members: ['check', 'fold'], label: 'middle' },
];

export function DiagramElkDemo() {
  const [nodes, setNodes] = useState(NODES);
  const [edges, setEdges] = useState(EDGES);
  const specs = useMemo(
    () => diagramScene({ nodes, edges, groups: GROUPS }, { layout: 'none', font: FONT }),
    [nodes, edges],
  );
  const view = useRef<DiagramViewApi>(null);
  return (
    <div className="ckd-stack">
      <div className="ckd-row">
        {CHOICES.map(([name, layout]) => (
          <Button key={name} onClick={() => view.current?.layout(layout)}>
            {name}
          </Button>
        ))}
      </div>
      <DemoStage width={640} height={400}>
        <DiagramView
          ref={view}
          specs={specs}
          className="ckd-canvas"
          ports="show"
          portOptions={PORTS}
          live={LIVE}
          onMove={(moves, routes) => {
            setNodes((ns) => moved(ns, moves));
            setEdges((es) => routed(es, routes));
          }}
        />
      </DemoStage>
    </div>
  );
}
