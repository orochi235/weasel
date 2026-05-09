import { useMemo } from 'react';
import {
  asNodeId,
  SceneCanvas,
  useScene,
  freeform,
  tileGrid,
  snapPoint,
} from '@orochi235/weasel';
import type { DrawCommand } from '@orochi235/weasel-gl';
import { useBackend } from '../BackendContext';

// --- Scene model ---
//
// Three side-by-side container nodes (F = freeform, G = tileGrid, S = snapPoint),
// each holding a single child rect. Dragging a child into a different container
// triggers the layout-aware move pass: the destination strategy reflows its
// hypothetical children, the source strategy reflows its leftovers, and the
// commit batch reparents the dragged child + writes the reflowed poses.

type P = { x: number; y: number; width: number; height: number };
type Data = { color: string; isContainer: boolean };

// Light fills so the containers are visible on the dark demo backdrop.
// Children get bolder accent colors that read against the muted container fills.
const COLORS: Record<string, string> = {
  F: '#a89878', G: '#88a878', S: '#7888a8',
  f1: '#f5b7a3', g1: '#a3f5b7', s1: '#a3b7f5',
};

const INITIAL = [
  { id: 'F',  parent: null, kind: 'container' as const, pose: { x: 10,  y: 40, width: 180, height: 180 } },
  { id: 'G',  parent: null, kind: 'container' as const, pose: { x: 210, y: 40, width: 180, height: 180 } },
  { id: 'S',  parent: null, kind: 'container' as const, pose: { x: 410, y: 40, width: 180, height: 180 } },
  { id: 'f1', parent: 'F',  kind: 'leaf' as const,      pose: { x: 50,  y: 80, width: 30,  height: 30 } },
  { id: 'g1', parent: 'G',  kind: 'leaf' as const,      pose: { x: 210, y: 40, width: 90,  height: 90 } },
  { id: 's1', parent: 'S',  kind: 'leaf' as const,      pose: { x: 420, y: 50, width: 30,  height: 30 } },
];

export function LayoutDemo() {
  const backend = useBackend();
  const scene = useScene<Data, 'default', P>({
    systemLayers: [{ id: 'default' }],
    initial: INITIAL.map((n) => ({
      kind: n.kind,
      layer: 'default',
      id: asNodeId(n.id),
      parent: n.parent ? asNodeId(n.parent) : null,
      pose: n.pose,
      data: { color: COLORS[n.id] ?? '#444', isContainer: n.kind === 'container' },
    })),
  });

  const layouts = useMemo(() => ({
    F: freeform<P>(),
    G: tileGrid<P>({ cols: 2, rows: 2 }),
    S: snapPoint<P>({ pattern: 'corners' }),
  }), []);

  return (
    <SceneCanvas
backend={backend}
            width={620}
      height={260}
      scene={scene}
      layouts={layouts}
      layers={{
        scene: {
          drawOne: (node, p): DrawCommand[] => {
            const cmds: DrawCommand[] = [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: node.data.color },
            }];
            if (node.data.isContainer) {
              cmds.push({
                kind: 'path',
                path: { kind: 'rect', x: p.x + 0.5, y: p.y + 0.5, width: p.width - 1, height: p.height - 1 },
                stroke: { paint: { color: '#d4c4a8' }, width: 1 },
              });
            }
            return cmds;
          },
        },
        // Outline-only selection — this demo's about layout, not resize.
        selectionOverlay: { handles: false },
      }}
    />
  );
}

export const LAYOUT_DEMO_SOURCE = `// Three containers, one of each layout strategy. Pass \`layouts\` to SceneCanvas
// and the layout-aware move pass runs on those containers automatically.
const scene = useScene<Data, 'default', P>({
  systemLayers: [{ id: 'default' }],
  initial: [
    { kind: 'container', id: asNodeId('F'), parent: null, pose, data, layer: 'default' },
    { kind: 'leaf',      id: asNodeId('f1'), parent: asNodeId('F'), pose, data, layer: 'default' },
    // ...G, g1, S, s1
  ],
});

const layouts = {
  F: freeform<P>(),
  G: tileGrid<P>({ cols: 2, rows: 2 }),
  S: snapPoint<P>({ pattern: 'corners' }),
};

<SceneCanvas scene={scene} layouts={layouts} layers={{ scene: { drawOne } }} />`;
