import { useEffect, useRef } from 'react';
import {
  asNodeId,
  SceneCanvas,
  WeaselProvider,
  useSceneAdapter,
  useScene,
  useSelection,
  useSelectTool,
  useRotateTool,
  useTools,
  pointSnapToGrid,
  ROTATED_POSE_DESCRIPTOR,
  useResizePolicy,
} from '@orochi235/weasel';
import type { RotatedPose, PoseProjection, CanvasExtensionApi } from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

interface Rect extends RotatedPose {
  id: string;
  color: string;
}

const W = 400, H = 300;
const SNAP_GRID = 20;

const INITIAL: Rect[] = [
  { id: 'a', x: 160, y: 100, width: 100, height: 60, rotation: Math.PI / 6, color: '#7fb069' },
];

function PointSnapDemoInner() {
  const scene = useScene({ items: INITIAL });
  const selection = useSelection({ mode: 'multi' });

  const adapter = useSceneAdapter(scene, { selection });

  const pickEvery = (worldX: number, worldY: number): string[] => {
    const hits: string[] = [];
    for (const id of scene.renderOrder()) {
      const n = scene.get(id);
      if (!n) continue;
      const p = n.pose as Rect;
      // Rotate the test point into the rect's local frame.
      const cx = p.x + p.width / 2;
      const cy = p.y + p.height / 2;
      const cos = Math.cos(-p.rotation);
      const sin = Math.sin(-p.rotation);
      const dx = worldX - cx;
      const dy = worldY - cy;
      const lx = cos * dx - sin * dy + cx;
      const ly = sin * dx + cos * dy + cy;
      if (lx >= p.x && lx <= p.x + p.width && ly >= p.y && ly <= p.y + p.height) {
        hits.push(id);
      }
    }
    return hits;
  };

  const boundsOf = (id: string) => {
    const n = scene.get(asNodeId(id));
    if (!n) return null;
    const p = n.pose as Rect;
    return { x: p.x, y: p.y, width: p.width, height: p.height, rotation: p.rotation };
  };

  const select = useSelectTool(adapter, {
    pickEvery,
    boundsOf,
    getSelection: () => selection.current,
  });
  // Resize is dispatcher-driven via the `resizePolicy` dep — see
  // `ResizePolicyBridge` below, mounted as a child of `<SceneCanvas>` so
  // `<DepRegistryProvider>` is in scope.
  function ResizePolicyBridge() {
    useResizePolicy<Rect>({
      projection: ROTATED_POSE_DESCRIPTOR as PoseProjection<Rect>,
      pointSnap: [pointSnapToGrid({ spacing: SNAP_GRID })],
    });
    return null;
  }
  const rotateTool = useRotateTool(adapter, {
    boundsOf,
    getSelection: () => [...selection.current],
    getNode: (id) => scene.get(asNodeId(id)) ?? null,
  });
  const tools = useTools({
    active: 'select',
    registry: { select },
    ambient: [rotateTool],
  });

  const canvasRef = useRef<CanvasExtensionApi | null>(null);
  useEffect(() => { canvasRef.current?.element?.focus(); }, []);

  const setSelection = selection.set;
  useEffect(() => {
    setSelection([asNodeId('a')]);
  }, [setSelection]);

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
      layers={{
        grid: {
          spacing: SNAP_GRID,
          bounds: () => ({ x: 0, y: 0, width: W, height: H }),
          style: {
            line: { paint: { fill: 'solid', color: '#3a3020' }, width: 1 },
          },
        },
        scene: {
          // drawOne returns unrotated geometry; SceneCanvas wraps the
          // output in a rotation transform when `pose.rotation` is set
          // (see `wrapWithPoseRotation` in `src/canvas/poseRotation.ts`).
          drawOne: (_node, p): DrawCommand[] => [{
            kind: 'path',
            path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
            fill: { color: p.color },
          }],
        },
        selectionOverlay: { rotationHandle: false },
      }}
    >
      <ResizePolicyBridge />
    </SceneCanvas>
  );
}

export function PointSnapDemo() {
  return <WeaselProvider><PointSnapDemoInner /></WeaselProvider>;
}
