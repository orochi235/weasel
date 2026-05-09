import {
  SceneCanvas,
  pointInRotatedRect,
  ROTATED_POSE_DESCRIPTOR,
  useScene,
} from '@orochi235/weasel';
import type { PoseDescriptor, RotatedPose } from '@orochi235/weasel';
import type { DrawCommand } from '@orochi235/weasel-gl';
import { useBackend } from '../BackendContext';

interface Rect extends RotatedPose {
  id: string;
  color: string;
}

const W = 320, H = 240, HANDLE = 8;

function INITIAL_RECT(color: string): Rect[] {
  return [{ id: 'a', x: 80, y: 70, width: 160, height: 100, rotation: Math.PI / 6, color }];
}

function drawRect(cx: CanvasRenderingContext2D, p: Rect): void {
  const cxw = p.x + p.width / 2;
  const cyw = p.y + p.height / 2;
  cx.save();
  cx.translate(cxw, cyw);
  cx.rotate(p.rotation);
  cx.translate(-cxw, -cyw);
  cx.fillStyle = p.color;
  cx.fillRect(p.x, p.y, p.width, p.height);
  cx.restore();
}

function drawRectGL(_node: unknown, p: Rect): DrawCommand[] {
  const cxw = p.x + p.width / 2;
  const cyw = p.y + p.height / 2;
  const cs = Math.cos(p.rotation);
  const sn = Math.sin(p.rotation);
  const a = cs, b = sn, c = -sn, d = cs;
  const tx = cxw - a * cxw - c * cyw;
  const ty = cyw - b * cxw - d * cyw;
  const transform = new Float32Array([a, b, 0, c, d, 0, tx, ty, 1]);
  return [{
    kind: 'group',
    transform,
    children: [{
      kind: 'path',
      path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      fill: { color: p.color },
    }],
  }];
}

function pickEveryFor(scene: ReturnType<typeof useScene<Rect>>) {
  return (wx: number, wy: number): string | null => {
    const ordered = [...scene.renderOrder()];
    for (let i = ordered.length - 1; i >= 0; i--) {
      const n = scene.get(ordered[i]);
      if (n && pointInRotatedRect(n.pose, wx, wy)) return n.id;
    }
    return null;
  };
}

/** Panel 1 — the full math (correct). */
function FullMathPanel() {
  const backend = useBackend();
  const scene = useScene({ items: INITIAL_RECT('#7fb069') });
  return (
    <SceneCanvas
      backend={backend}
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selectTool={{
        handleHitRadius: HANDLE,
        resize: { geometry: ROTATED_POSE_DESCRIPTOR as PoseDescriptor<Rect> },
      }}
      geometry={{ pickEvery: pickEveryFor(scene) }}
      selectionOptions={{ initial: ['a'] }}
      layers={{
        scene: { drawOne: (cx, _n, p) => drawRect(cx, p), drawOneGL: drawRectGL },
        selectionOverlay: { handles: { size: HANDLE }, rotationHandle: false },
      }}
    />
  );
}

export function RotatedResizeMathDemo() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <FullMathPanel />
      {/* Counterexample panels added in Task 8 */}
    </div>
  );
}

export const ROTATED_RESIZE_MATH_DEMO_SOURCE = `// Math explainer — see RotatedResizeMathDemo.tsx`;
