import { useEffect, useMemo, useState } from 'react';
import { autoSkin } from '@weasel-js/animator';
import type { Skeleton, Skin } from '@weasel-js/animator';
import {
  asNodeId,
  createRigEditState,
  dataRestPath,
  placeSkeleton,
  polygonFromPoints,
  SceneCanvas,
  solid,
  useRigNode,
  useScene,
} from '@weasel-js/core';
import type { NodeId, Path, RectPose, Stroke, Fill } from '@weasel-js/core';
import num from '@weasel-js/theme/numeric.module.css';
import { DemoStage } from './DemoStage';

const W = 600, H = 320;
const BOX: RectPose = { x: 80, y: 180, width: 440, height: 100 };
const BONE = 180, HALF = 18, MID = 50;

type Data = { skeleton?: Skeleton; skin?: Skin; path?: Path; fill?: Fill | null; stroke?: Stroke };
interface NodeSpec {
  id: NodeId; kind: 'leaf' | 'container'; layer: 'main'; parent?: NodeId; pose: RectPose; data: Data;
  clipFromPose?: () => null;
}

const RIG = asNodeId('arm'), SLEEVE = asNodeId('sleeve');
const bone = (name: string, parent: string | null, x: number, y: number) => (
  { name, parent, bind: { x, y, rotation: 0, scaleX: 1, scaleY: 1 } }
);
/** Relative to the rig node's box: shoulder 40 in, then two bones along +x. */
const ARM: Skeleton = { joints: [bone('shoulder', null, 40, MID), bone('elbow', 'shoulder', BONE, 0), bone('wrist', 'elbow', BONE, 0)] };

const X0 = BOX.x + 40, Y0 = BOX.y + MID;
const SLEEVE_PATH = polygonFromPoints([
  ...Array.from({ length: 19 }, (_, i) => ({ x: X0 + i * 20, y: Y0 - HALF })),
  ...Array.from({ length: 19 }, (_, i) => ({ x: X0 + 360 - i * 20, y: Y0 + HALF })),
]);

const INITIAL: NodeSpec[] = [
  // A container clips its children to its box unless told otherwise, and a limb bends out of it.
  { id: RIG, kind: 'container', layer: 'main', pose: BOX, data: { skeleton: ARM, fill: null }, clipFromPose: () => null },
  {
    id: SLEEVE, kind: 'leaf', layer: 'main', parent: RIG,
    pose: { x: X0, y: Y0 - HALF, width: 360, height: 2 * HALF },
    data: {
      path: SLEEVE_PATH, fill: { paint: solid('#d4a574') },
      stroke: { paint: { color: '#2b2118' }, width: 3, join: 'round' },
      skin: autoSkin(SLEEVE_PATH, placeSkeleton(ARM, BOX)),
    },
  },
];

export function RigToolsDemo() {
  const scene = useScene<Data, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: useMemo(() => INITIAL, []),
  });
  const [bend, setBend] = useState(0);
  const state = useMemo(() => createRigEditState(), []);
  // The tools edit the one arm whatever is selected, and share their joint and the
  // stroke being painted with `useRigNode`, which shows the stroke as it goes.
  const toolOptions = useMemo(() => ({ rig: { rig: () => RIG, state } }), [state]);

  const rig = useRigNode({ scene, node: RIG, painting: state });
  useEffect(() => {
    rig.pose(Object.fromEntries(rig.skeleton.joints.slice(1).map((j) => [j.name, { rotation: -bend }])));
  }, [rig, bend]);

  const reweigh = () => {
    const arm = scene.get(RIG)!, sleeve = scene.get(SLEEVE)!;
    const skin = autoSkin(dataRestPath(sleeve)!, placeSkeleton(arm.data.skeleton!, arm.pose));
    scene.update(SLEEVE, { data: { ...sleeve.data, skin } });
  };

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        <label className="ckd-field">
          bend
          <input
            className="ckd-range" type="range" min={0} max={1.4} step={0.01}
            value={bend} onChange={(e) => setBend(Number(e.target.value))}
          />
          <span className={`ckd-readout ${num.numeric}`}>{bend.toFixed(2)}</span>
        </label>
        <button className="ckd-btn" onClick={reweigh}>weigh from bones</button>
        <button className="ckd-btn" onClick={() => scene.undo()}>undo</button>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          className="ckd-canvas"
          scene={scene}
          features={['pick', 'paths']}
          defaultTools={['bone', 'weight']}
          toolOptions={toolOptions}
          claimKeys
        />
      </DemoStage>
      <div className="ckd-hint">
        The arm is one container node with a skeleton in its <code>data.skeleton</code> and one
        path under it with weights in its <code>data.skin</code>; <code>useRigNode</code> binds a
        rig from them and binds again after every edit. Press <kbd>J</kbd> for the bone tool:
        drag a joint to move it, drag from empty space to draw a bone from the active joint,
        <kbd>Delete</kbd> to remove it. Press <kbd>W</kbd> for the weight tool: click a joint,
        then brush over the dots to make them follow it, with <kbd>Alt</kbd> to make them let
        go. Both tools edit the arm as it rests, so set bend to 0 to see what you are editing,
        then bend it to see the result. <kbd>V</kbd> goes back to selecting, and there a
        double-click on the sleeve edits its points: <kbd>Alt</kbd>-click an edge to add one and
        <kbd>Delete</kbd> to remove the selected ones, and the weights stay with their points.
      </div>
    </div>
  );
}
