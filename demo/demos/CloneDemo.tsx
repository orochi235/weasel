import { SceneCanvas } from '@orochi235/weasel';
import sceneJson from './data/clone.scene.json';

export function CloneDemo() {
  // SceneCanvas's `toolBundle="exhaustive"` includes useCloneTool with the
  // built-in `cloneByAltDrag` behavior — Alt+drag a rect to spawn a copy.
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
