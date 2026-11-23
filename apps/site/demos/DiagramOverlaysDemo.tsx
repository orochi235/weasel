import { useEffect, useMemo, useRef, useState } from 'react';
import { DiagramView, diagramScene, edgeIdOf, type DataEdge, type DataNode } from '@weasel-js/diagram';
import { Button } from '@weasel-js/ui/components/Button';
import { FONT } from './diagram/shared';
import { DemoStage } from './DemoStage';

const START = {
  nodes: [{ id: 'source', lines: ['source'] }, { id: 'sink', lines: ['sink'] }] as DataNode[],
  edges: [{ from: 'source', to: 'sink' }] as DataEdge[],
};

/** `edge` split by a new node `id` standing on it. */
function insertOn(data: typeof START, edge: DataEdge, id: string): typeof START {
  return {
    nodes: [...data.nodes, { id, lines: [id] }],
    edges: [...data.edges.filter((e) => e !== edge), { from: edge.from, to: id }, { from: id, to: edge.to }],
  };
}

function wiresOf(edges: readonly DataEdge[], id: string): string {
  const n = edges.filter((e) => e.from === id || e.to === id).length;
  return n === 1 ? '1 wire' : `${n} wires`;
}

/** How long an edge's hover outlasts the pointer, long enough to reach the "+" on it. */
const LINGER_MS = 250;

/** The edge under the pointer, kept while the pointer is on its "+" (`stay`)
 *  and for `LINGER_MS` after it leaves both, then cleared. */
export function useEdgeHover() {
  const [hovered, setHovered] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stay = () => clearTimeout(timer.current);
  const leave = () => {
    stay();
    timer.current = setTimeout(() => setHovered(null), LINGER_MS);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    hovered,
    onHover: (id: string | null) => {
      if (id === null) return leave();
      stay();
      setHovered(id);
    },
    stay,
    leave,
    clear: () => { stay(); setHovered(null); },
  };
}

export function DiagramOverlaysDemo() {
  const [data, setData] = useState(START);
  const [picked, setPicked] = useState<string | null>(null);
  const { hovered, onHover, stay, leave, clear } = useEdgeHover();
  const specs = useMemo(() => diagramScene(data, { font: FONT, layoutOptions: { direction: 'right' } }), [data]);
  const edgeById = new Map(data.edges.map((e) => [edgeIdOf(e), e]));
  const hoveredEdge = hovered === null ? undefined : edgeById.get(hovered);
  const node = data.nodes.find((n) => n.id === picked);

  const overlays = [
    ...(hoveredEdge === undefined ? [] : [{
      target: hovered!,
      content: (
        <span onPointerEnter={stay} onPointerLeave={leave}>
          <Button
            onClick={() => {
              setData((d) => insertOn(d, hoveredEdge, `step ${d.nodes.length - 1}`));
              clear();
            }}
          >
            +
          </Button>
        </span>
      ),
    }]),
    ...(node === undefined ? [] : [{
      target: node.id,
      placement: { side: 'right' as const, align: 'start' as const },
      offset: 8,
      content: <div className="ckd-overlay-card">{node.id}: {wiresOf(data.edges, node.id)}</div>,
    }]),
  ];

  return (
    <DemoStage width={640} height={320}>
      <DiagramView
        specs={specs}
        className="ckd-canvas"
        pickEdges
        selection={picked}
        onSelectionChange={(id) => setPicked(id !== null && data.nodes.some((n) => n.id === id) ? id : null)}
        onHover={onHover}
        overlays={overlays}
      />
    </DemoStage>
  );
}
