import { useMemo, useRef } from 'react';
import {
  asNodeId,
  cloneByAltDrag,
  SceneCanvas,
  sceneToAdapter,
  useCloneTool,
  useKeybindings,
  useScene,
  useSelection,
  useSelectTool,
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

  const selection = useSelection({ mode: 'multi', extend: 'shift' });

  const adapter = useMemo(() => ({
    ...sceneToAdapter(scene, { selection }),
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
  }), [scene, selection]);

  const pickEvery = (worldX: number, worldY: number): string[] => {
    const hits: string[] = [];
    for (const id of scene.renderOrder()) {
      const n = scene.get(id);
      if (!n) continue;
      const p = n.pose as Rect;
      if (worldX >= p.x && worldX <= p.x + p.width
          && worldY >= p.y && worldY <= p.y + p.height) {
        hits.push(id);
      }
    }
    return hits;
  };

  const boundsOf = (id: string) => {
    const n = scene.get(asNodeId(id));
    if (!n) return null;
    const p = n.pose as Rect;
    return { x: p.x, y: p.y, width: p.width, height: p.height };
  };

  const drawRect = (n: { data: Rect } | Rect, p: Rect): DrawCommand[] => {
    const r = 'data' in n ? n.data : n;
    return [{
      kind: 'path',
      path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      fill: { color: r.color },
    }];
  };

  const clone = useCloneTool(adapter, {
    behaviors: [cloneByAltDrag()],
    drawOne: drawRect,
    cloneSelection: true,
  });

  const select = useSelectTool(adapter, {
    pickEvery,
    boundsOf,
    getSelection: () => selection.current,
  });

  // Active tool is `select`; clone sits in ambient and engages when Alt
  // is held (via the tool's built-in `hotkey: 'alt'`). Plain drags fall
  // through to select-move; Alt+drag claims via cloneByAltDrag.
  const tools = useTools({
    active: 'select',
    registry: { select, clone },
    ambient: [clone],
  });
  // SceneCanvas disables its internal keybindings when a custom `tools`
  // prop is supplied — wire them here so clone's `hotkey: 'alt'` engages
  // the cursor while Alt is held.
  useKeybindings(tools);

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selection={selection}
      selectionMode="multi"
      tools={tools}
      layers={{
        scene: {
          drawOne: (n, p): DrawCommand[] => [{
            kind: 'path',
            path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
            fill: { color: (n.data as Rect).color },
          }],
        },
      }}
    />
  );
}
