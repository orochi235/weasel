import {
  ellipsePath,
  registerShapePainter,
  SceneCanvas,
} from '@orochi235/weasel';
import sceneJson from './data/clipping.scene.json';

// Register at module load so the painter is in the registry BEFORE
// SceneCanvas's first paint — useEffect would fire after the initial
// render and the ellipse would briefly appear as a rect. The painter
// teaches the kit both the visual (paint) and the clip silhouette for
// any node whose data carries `shape: 'ellipse'`.
registerShapePainter(
  {
    id: 'demo:ellipse',
    matches: (n) => (n.data as { shape?: string } | null)?.shape === 'ellipse',
    paint: (n, pose) => {
      const d = n.data as { color?: string } | null;
      return [{
        kind: 'path',
        path: ellipsePath(pose as { x: number; y: number; width: number; height: number }),
        fill: { color: d?.color ?? '#888' },
      }];
    },
    silhouette: (_n, pose) => ellipsePath(pose as { x: number; y: number; width: number; height: number }),
  },
  { priority: 'high' },
);

export function ClippingDemo() {
  return (
    <SceneCanvas
      width={400}
      height={300}
      className="ckd-canvas"
      scene={sceneJson}
    />
  );
}
