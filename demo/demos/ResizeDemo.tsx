import { SceneCanvas, useScene } from '@orochi235/weasel';
import type { DrawCommand } from '@orochi235/weasel-gl';
import { useBackend } from '../BackendContext';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 400, H = 300, HANDLE = 8;

const INITIAL: Rect = { id: 'r', x: 100, y: 80, width: 180, height: 130, color: '#7fb069' };

export function ResizeDemo() {
  const backend = useBackend();
  const scene = useScene({ items: [INITIAL] });

  return (
    <SceneCanvas
backend={backend}
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

export const RESIZE_DEMO_SOURCE = `// --- Scene (kit-owned via useScene shorthand) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const scene = useScene({ items: [INITIAL] });

// <SceneCanvas> wires sceneToAdapter + undo/redo automatically.
// drawOne receives the Scene Node; pose === item under the trivial overload.
return (
  <SceneCanvas
    width={W} height={H}
    scene={scene}
    selectTool={{ handleHitRadius: HANDLE }}
    selectionOptions={{ initial: ['r'] }}
    layers={{
      scene: { drawOne: (cx, _node, p) => { cx.fillStyle = p.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      selectionOverlay: { handles: { size: HANDLE } },
    }}
  />
);
`;
