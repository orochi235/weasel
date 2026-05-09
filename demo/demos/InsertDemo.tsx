import { useMemo, useRef } from 'react';
import {
  asNodeId,
  SceneCanvas,
  useInsertTool,
  useScene,
  useTools,
} from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 400, H = 300;
const COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#d47a7a', '#7ab8d4'];

export function InsertDemo() {
  const scene = useScene<Rect>({ items: [] });
  const nextId = useRef(0);

  // useInsertTool only calls `commitInsert`; the other InsertAdapter members
  // are stubbed since SceneCanvas's selection/clipboard hooks aren't wired in
  // this demo. The factory adds a leaf node directly to the scene and returns
  // it so the gesture's commit path has something to hand back.
  const insertAdapter = useMemo(() => ({
    commitInsert: (b: { x: number; y: number; width: number; height: number }): Rect | null => {
      const id = `r${nextId.current++}`;
      const item: Rect = {
        id,
        x: b.x, y: b.y, width: b.width, height: b.height,
        color: COLORS[nextId.current % COLORS.length],
      };
      scene.add({ kind: 'leaf', layer: 'default', pose: item, data: item, id: asNodeId(id) });
      return item;
    },
    commitPaste: () => [],
    snapshotSelection: () => ({ items: [] }),
    insertObject: () => {},
    setSelection: () => {},
    getSelection: () => [] as string[],
  }), [scene]);

  const insert = useInsertTool<Rect, Rect>(insertAdapter, { minBounds: { width: 4, height: 4 } });
  const tools = useTools({ active: 'insert', registry: { insert } });

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      tools={tools}
      selectionMode="none"
      layers={{
        scene: {
          drawOne: (_node, p) => [{
            kind: 'path',
            path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
            fill: { color: p.color },
          }],
        },
        selectionOverlay: null,
      }}
    />
  );
}
