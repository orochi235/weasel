import { SceneCanvas } from '@orochi235/weasel';
import sceneJson from './data/clone.scene.json';

const W = 400, H = 300;

export function CloneDemo() {
  // SceneCanvas's `toolBundle="everything"` includes useCloneTool with the
  // built-in `cloneByAltDrag` behavior — Alt+drag a rect to spawn a copy.
  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={sceneJson}
      selectionMode="multi"
      toolBundle="everything"
    />
  );
}
