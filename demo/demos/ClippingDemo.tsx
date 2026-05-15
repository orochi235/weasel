import { SceneCanvas } from '@orochi235/weasel';
import sceneJson from './data/clipping.scene.json';

// The kit's built-in `kit:shape` painter dispatches on `data.shape` —
// `'rect' | 'ellipse' | 'polygon' | 'star'` — and supplies both the paint
// AND silhouette from the pose. Container nodes with shape: 'ellipse'
// (like the bed in this scene) clip their descendants to the ellipse
// without any consumer-side painter registration.
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
