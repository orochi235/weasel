import { SceneCanvas } from '@orochi235/weasel';
import type { SerializedScene } from '@orochi235/weasel';
import sceneJson from './data/clone.scene.json';

interface RectData { color: string }
interface RectPose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;

export function CloneDemo() {
  // SceneCanvas's `toolBundle="everything"` includes useCloneTool with the
  // built-in `cloneByAltDrag` behavior — Alt+drag a rect to spawn a copy.
  // Default clone target is the hit object; multi-selection cloning would
  // need per-tool options the kit doesn't surface through toolBundle yet.
  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={sceneJson as unknown as SerializedScene<RectData, 'default', RectPose>}
      selectionMode="multi"
      toolBundle="everything"
    />
  );
}
