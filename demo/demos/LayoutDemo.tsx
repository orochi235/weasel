import { useMemo, useState } from 'react';
import {
  Canvas,
  useSelectTool,
  useTools,
  freeform,
  tileGrid,
  snapPoint,
} from '@orochi235/weasel';
import type { LayoutStrategy } from '@orochi235/weasel';

// --- Scene model ---
//
// Three side-by-side container objects (F = freeform, G = tileGrid, S = snapPoint),
// each holding a single child rect. Dragging a child into a different container
// triggers the layout-aware move pass: the destination strategy reflows its
// hypothetical children, the source strategy reflows its leftovers, and the
// commit batch reparents the dragged child + writes the reflowed poses.

type Obj = { id: string; kind: 'container' | 'child' };
type P = { x: number; y: number; width: number; height: number };

interface SceneState {
  poses: Record<string, P>;
  parents: Record<string, string | null>;
  children: Record<string, string[]>;
}

const INITIAL: SceneState = {
  poses: {
    F: { x: 10,  y: 40, width: 180, height: 180 },
    G: { x: 210, y: 40, width: 180, height: 180 },
    S: { x: 410, y: 40, width: 180, height: 180 },
    f1: { x: 50,  y: 80, width: 30, height: 30 },
    g1: { x: 210, y: 40, width: 90, height: 90 },
    s1: { x: 420, y: 50, width: 30, height: 30 },
  },
  parents: { F: null, G: null, S: null, f1: 'F', g1: 'G', s1: 'S' },
  children: { F: ['f1'], G: ['g1'], S: ['s1'] },
};

// Light fills so the containers are visible on the dark demo backdrop.
// Children get bolder accent colors that read against the muted container fills.
const COLORS: Record<string, string> = {
  F: '#a89878', G: '#88a878', S: '#7888a8',
  f1: '#f5b7a3', g1: '#a3f5b7', s1: '#a3b7f5',
};

export function LayoutDemo() {
  const [scene, setScene] = useState<SceneState>(INITIAL);

  const layouts = useMemo(() => ({
    F: freeform<P>(),
    G: tileGrid<P>({ cols: 2, rows: 2 }),
    S: snapPoint<P>({ pattern: 'corners' }),
  }), []);

  const isContainer = (id: string) => id in layouts;

  const adapter = useMemo(() => ({
    getObject: (id: string): Obj | undefined =>
      scene.poses[id] ? { id, kind: isContainer(id) ? 'container' : 'child' } : undefined,
    getObjects: (): Obj[] =>
      Object.keys(scene.poses).map((id) => ({
        id,
        kind: isContainer(id) ? 'container' : 'child',
      })),
    getPose: (id: string) => scene.poses[id],
    getParent: (id: string) => scene.parents[id] ?? null,
    setPose: (id: string, pose: P) => {
      setScene((s) => ({ ...s, poses: { ...s.poses, [id]: pose } }));
    },
    setParent: (id: string, parentId: string | null) => {
      setScene((s) => {
        const oldParent = s.parents[id];
        const nextParents = { ...s.parents, [id]: parentId };
        const nextChildren = { ...s.children };
        if (oldParent && nextChildren[oldParent]) {
          nextChildren[oldParent] = nextChildren[oldParent].filter((c) => c !== id);
        }
        if (parentId) {
          nextChildren[parentId] = [...(nextChildren[parentId] ?? []), id];
        }
        return { ...s, parents: nextParents, children: nextChildren };
      });
    },
    getChildren: (id: string) => scene.children[id] ?? [],
    getLayout: (id: string): LayoutStrategy<P> | null =>
      (layouts as Record<string, LayoutStrategy<P> | undefined>)[id] ?? null,
    // Area-select / select-tool plumbing (unused in this demo but required by
    // useSelectTool's adapter intersection).
    hitTestArea: (rect: P) =>
      Object.keys(scene.poses).filter((id) => {
        const p = scene.poses[id];
        return p.x < rect.x + rect.width && p.x + p.width > rect.x &&
               p.y < rect.y + rect.height && p.y + p.height > rect.y;
      }),
    getSelection: () => [] as string[],
    setSelection: () => {},
    applyOps: () => {},
    applyBatch: () => {},
  }), [scene, layouts]);

  const select = useSelectTool<Obj, P>(adapter, {
    hitBody: (wx, wy) =>
      Object.keys(scene.poses).filter((id) => {
        const p = scene.poses[id];
        return wx >= p.x && wx <= p.x + p.width && wy >= p.y && wy <= p.y + p.height;
      }),
    boundsOf: (id) => scene.poses[id] ?? null,
    drawGhost: (cx, _o, p) => {
      cx.fillStyle = 'rgba(212, 196, 168, 0.4)';
      cx.fillRect(p.x, p.y, p.width, p.height);
    },
    getObject: (id) => adapter.getObject(id) ?? null,
  });
  const tools = useTools({ active: 'select', registry: { select } });

  return (
    <Canvas
      width={620}
      height={260}
      adapter={adapter}
      tools={tools}
      layers={{
        scene: {
          drawOne: (cx, o, p) => {
            cx.fillStyle = COLORS[o.id] ?? '#444';
            cx.fillRect(p.x, p.y, p.width, p.height);
            if (isContainer(o.id)) {
              cx.strokeStyle = '#d4c4a8';
              cx.lineWidth = 1;
              cx.strokeRect(p.x + 0.5, p.y + 0.5, p.width - 1, p.height - 1);
            }
          },
        },
      }}
    />
  );
}

export const LAYOUT_DEMO_SOURCE = `// Three containers, one of each layout strategy, sharing one adapter.
const layouts = {
  F: freeform<P>(),
  G: tileGrid<P>({ cols: 2, rows: 2 }),
  S: snapPoint<P>({ pattern: 'corners' }),
};

const adapter = {
  // ...standard MoveAdapter members...
  getChildren: (id) => children[id] ?? [],
  getLayout: (id) => layouts[id] ?? null,  // <-- this opt-in unlocks layout-aware move
};

const select = useSelectTool<Obj, P>(adapter, { hitBody, boundsOf, drawGhost });
const tools = useTools({ active: 'select', registry: { select } });

<Canvas adapter={adapter} tools={tools} layers={{ scene: { drawOne } }} />`;
