import { useMemo, useState } from 'react';
import { solid } from '@weasel-js/paint';
import {
  SceneCanvas,
  asNodeId,
  easeInOutCubic,
  pathFromD,
  pathMotion,
  tweenPose,
  useScene,
  useSceneAdapter,
  type RectPose,
  pathNode,
} from '@weasel-js/core';
import { useAnimator } from '@weasel-js/animator/react';
import type { Fill, Path, Stroke } from '@weasel-js/core';
import { Button } from '@weasel-js/ui/components/Button';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { DemoStage } from './DemoStage';

type Data = { shape?: 'rect'; path?: Path; fill?: Fill; stroke?: Stroke };

const W = 480, H = 300;
const TRACK = pathFromD('M 50 240 C 50 60 200 60 240 150 S 430 240 430 60');
const RIDER = asNodeId('rider');

export function PathMotionDemo() {
  const scene = useScene<Data, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: useMemo(() => [
      pathNode('track', TRACK, { stroke: { paint: solid('#9aa7b4'), width: 2 } }, { layer: 'main' }),
      { id: RIDER, kind: 'mark' as const, layer: 'main' as const, pose: { x: 30, y: 230, width: 40, height: 20, rotation: 0 }, data: { shape: 'rect', fill: { paint: solid('#d4774f') } } },
    ], []),
  });
  const adapter = useSceneAdapter(scene);
  const animator = useAnimator();
  const [orient, setOrient] = useState(true);

  const ride = () => {
    const motion = pathMotion(TRACK, { orient });
    // Unoriented, pathMotion keeps the rider's own rotation, which an oriented ride left at the track's end tangent.
    const from = { ...scene.get(RIDER)!.pose, rotation: 0 };
    const to = motion.at(from, 1);
    tweenPose(animator, adapter, { id: RIDER, from, to, geometry: motion, ms: 2400, easing: easeInOutCubic });
  };

  return (
    <div>
      <div className="ckd-toolbar">
        <Button onClick={ride}>ride</Button>
        <Checkbox isSelected={orient} onChange={setOrient}>turn with the path</Checkbox>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas className="ckd-canvas" scene={scene} />
      </DemoStage>
    </div>
  );
}
