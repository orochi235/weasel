import { useEffect, useMemo, useState } from 'react';
import { autoSkin } from '@weasel-js/animator';
import type { Skeleton, Skin } from '@weasel-js/animator';
import { asNodeId, dataRestPath, placeSkeleton, polygonFromPoints, SceneCanvas, solid, useRigNode, WeaselProvider, useScene } from '@weasel-js/core';
import { pathsPreset } from '@weasel-js/path-tools';
import type { NodeId, Path, RectPose, Stroke, Fill } from '@weasel-js/core';
import { createRigEditState, useRigTools } from '@weasel-js/rig';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { Field } from '@weasel-js/ui/components/Field';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';
import { Button } from '@weasel-js/ui/components/Button';
import { DemoStage } from './DemoStage';
import { pickPreset } from '@weasel-js/editing';

const W = 600, H = 320;
const BOX: RectPose = { x: 80, y: 180, width: 440, height: 100 };
const BONE = 180, HALF = 18, MID = 50;

type Data = { skeleton?: Skeleton; skin?: Skin; path?: Path; fill?: Fill | null; stroke?: Stroke };
interface NodeSpec {
  id: NodeId; kind: 'mark' | 'group'; layer: 'main'; parent?: NodeId; pose: RectPose; data: Data;
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
  { id: RIG, kind: 'group', layer: 'main', pose: BOX, data: { skeleton: ARM, fill: null } },
  {
    id: SLEEVE, kind: 'mark', layer: 'main', parent: RIG,
    pose: { x: X0, y: Y0 - HALF, width: 360, height: 2 * HALF },
    data: {
      path: SLEEVE_PATH, fill: { paint: solid('#d4a574') },
      stroke: { paint: { color: '#2b2118' }, width: 3, join: 'round' },
      skin: autoSkin(SLEEVE_PATH, placeSkeleton(ARM, BOX)),
    },
  },
];

export function RigToolsDemo() {
  return <WeaselProvider><RigTools /></WeaselProvider>;
}

function RigTools() {
  const scene = useScene<Data, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: useMemo(() => INITIAL, []),
  });
  const [bend, setBend] = useState(0);
  const state = useMemo(() => createRigEditState(), []);
  // The tools edit the one arm whatever is selected, and share their joint and the
  // stroke being painted with `useRigNode`, which shows the stroke as it goes.
  const tools = useRigTools({ scene, rig: () => RIG, state });

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
        <Field orientation="row" className="ckd-field" label="bend" output={<span className="ckd-readout">{bend.toFixed(2)}</span>}>
          <InlineRange
            min={0} max={1.4} step={0.01}
            value={bend} onChange={(e) => setBend(Number(e.target.value))}
          />
        </Field>
        <Button onClick={reweigh}>weigh from bones</Button>
        <ActionBar group="history" />
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          className="ckd-canvas"
          scene={scene}
          features={[pickPreset, pathsPreset]}
          tools={tools}
          claimKeys
        />
      </DemoStage>
    </div>
  );
}
