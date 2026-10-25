import { useMemo, useState } from 'react';
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

export function DiagramOverlaysDemo() {
  const [data, setData] = useState(START);
  const [picked, setPicked] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const specs = useMemo(() => diagramScene(data, { font: FONT, layoutOptions: { direction: 'right' } }), [data]);
  const edgeById = new Map(data.edges.map((e) => [edgeIdOf(e), e]));
  const hoveredEdge = hovered === null ? undefined : edgeById.get(hovered);
  const node = data.nodes.find((n) => n.id === picked);

  const overlays = [
    ...(hoveredEdge === undefined ? [] : [{
      target: hovered!,
      content: (
        <Button
          onClick={() => {
            setData((d) => insertOn(d, hoveredEdge, `step ${d.nodes.length - 1}`));
            setHovered(null);
          }}
        >
          +
        </Button>
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
        selected={picked}
        onSelect={(id) => setPicked(id !== null && data.nodes.some((n) => n.id === id) ? id : null)}
        onHover={(id) => { if (id !== null) setHovered(id); }}
        overlays={overlays}
      />
    </DemoStage>
  );
}
