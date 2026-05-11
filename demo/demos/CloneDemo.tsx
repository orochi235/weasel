import { useMemo, useRef } from 'react';
import {
  asNodeId,
  cloneByAltDrag,
  SceneCanvas,
  useCloneTool,
  useScene,
  useTools,
} from '@orochi235/weasel';
import type { ClipboardSnapshot } from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 400, H = 300;

const INITIAL: Rect[] = [
  { id: 'a', x: 60,  y: 80,  width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 220, y: 140, width: 80, height: 60, color: '#d4a574' },
];

export function CloneDemo() {
  const scene = useScene<Rect>({ items: INITIAL });
  const nextId = useRef(0);

  const adapter = useMemo(() => ({
    getNodes: (): Rect[] => {
      const out: Rect[] = [];
      for (const id of scene.renderOrder()) {
        const n = scene.get(id);
        if (n) out.push(n.data as Rect);
      }
      return out;
    },
    getPose: (id: string): Rect => scene.get(asNodeId(id))!.pose as Rect,
    getSelection: () => [] as string[],
    setSelection: () => {},
    snapshotSelection: (ids: string[]): ClipboardSnapshot => ({
      items: ids.map((id) => scene.get(asNodeId(id))!.data as Rect),
    }),
    commitInsert: () => null,
    commitPaste: (clip: ClipboardSnapshot, offset: { dx: number; dy: number }): Rect[] =>
      (clip.items as Rect[]).map((src) => ({
        ...src,
        id: `clone-${nextId.current++}`,
        x: src.x + offset.dx,
        y: src.y + offset.dy,
      })),
    insertNode: (rect: Rect) => {
      scene.add({
        kind: 'leaf',
        layer: 'default',
        pose: rect,
        data: rect,
        id: asNodeId(rect.id),
      });
    },
  }), [scene]);

  const drawRect = (r: Rect, p: Rect): DrawCommand[] => [{
    kind: 'path',
    path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
    fill: { color: r.color },
  }];

  const clone = useCloneTool(adapter, {
    behaviors: [cloneByAltDrag()],
    drawOne: drawRect,
  });

  const tools = useTools({ active: 'clone', registry: { clone } });

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
          drawOne: (n, p): DrawCommand[] => [{
            kind: 'path',
            path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
            fill: { color: (n.data as Rect).color },
          }],
        },
        selectionOverlay: null,
      }}
    />
  );
}
