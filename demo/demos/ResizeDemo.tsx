import { SceneCanvas, useScene } from '@orochi235/weasel';
import type { DrawCommand } from '@orochi235/weasel-gl';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 400, H = 300, HANDLE = 8;

const INITIAL: Rect = { id: 'r', x: 100, y: 80, width: 180, height: 130, color: '#7fb069' };

export function ResizeDemo() {
  const scene = useScene({ items: [INITIAL] });

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selectTool={{ handleHitRadius: HANDLE }}
      selectionOptions={{ initial: [INITIAL.id] }}
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
