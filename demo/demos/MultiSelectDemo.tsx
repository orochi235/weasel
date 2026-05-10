import { useEffect, useMemo, useRef } from 'react';
import {
  asNodeId,
  SceneCanvas,
  sceneToAdapter,
  selectFromMarquee,
  useScene,
  useSelection,
  useSelectTool,
  useTools,
} from '@orochi235/weasel';
import type { DrawCommand } from '@orochi235/weasel-gl';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 400, H = 300, HANDLE = 8;

const INITIAL: Rect[] = [
  { id: 'a', x: 40,  y: 40,  width: 70, height: 50, color: '#7fb069' },
  { id: 'b', x: 150, y: 70,  width: 60, height: 60, color: '#d4a574' },
  { id: 'c', x: 250, y: 50,  width: 80, height: 70, color: '#a48bd4' },
  { id: 'd', x: 90,  y: 170, width: 60, height: 60, color: '#7ab8d4' },
  { id: 'e', x: 220, y: 180, width: 90, height: 60, color: '#d47a7a' },
];

export function MultiSelectDemo() {
  const scene = useScene({ items: INITIAL });
  const selection = useSelection({ mode: 'multi' });

  // sceneToAdapter covers Move/Resize/Rotate AND AreaSelect — the marquee
  // hitTestArea/applyOps and selection get/set are kit-defaulted from the
  // scene + the selection passed in.
  const selectAdapter = useMemo(
    () => sceneToAdapter(scene, { selection }),
    [scene, selection],
  );

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

  const select = useSelectTool(selectAdapter, {
    pickEvery,
    boundsOf,
    getSelection: () => selection.current,
    // Marquee is opt-in at the kit level — restored here because the demo's
    // whole point is multi-selection.
    areaSelect: { behaviors: [selectFromMarquee()] },
  });
  const tools = useTools({ active: 'select', registry: { select } });

  // Cmd/Ctrl+A is auto-registered by SceneCanvas's default actions.

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    canvasRef.current?.focus();
  }, []);

  return (
    <SceneCanvas
      ref={canvasRef}
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selection={selection}
      selectionMode="multi"
      tools={tools}
      selectTool={{ handleHitRadius: HANDLE }}
      layers={{
        scene: {
          drawOne: (_node, p): DrawCommand[] => [{
            kind: 'path',
            path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
            fill: { color: p.color },
          }],
        },
        selectionOverlay: { handles: { size: HANDLE } },
      }}
    />
  );
}
