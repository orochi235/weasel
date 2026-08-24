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
} from '@weasel-js/core';
import type { RotatedPose, PoseProjection, SceneCanvasApi } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';

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

  const boundsOf = (id: string) => {
    const n = scene.get(asNodeId(id));
    if (!n) return null;
    const p = n.pose as Rect;
    return { x: p.x, y: p.y, width: p.width, height: p.height, rotation: p.rotation };
  };

  const select = useSelectTool(adapter, { leafPicking: 'silhouette' });
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

  const canvasRef = useRef<SceneCanvasApi | null>(null);
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
