import { SceneCanvas } from '@orochi235/weasel';
import sceneJson from './data/clone.scene.json';

export function CloneDemo() {
  // The select tool's alt-drag binding routes to `cloneAction` — Alt+drag a
  // rect to spawn a copy. No dedicated clone tool needed.
  return (
    <SceneCanvas
      width={400}
      height={300}
      className="ckd-canvas"
      scene={sceneJson}
      selectionMode="multi"
      toolBundle="exhaustive"
    />
  );
}
