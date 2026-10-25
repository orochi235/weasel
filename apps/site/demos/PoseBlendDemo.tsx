import { useState } from 'react';
import { SceneCanvas, asNodeId, springPose, tweenPose, useScene, useSceneAdapter } from '@weasel-js/core';
import { useAnimator } from '@weasel-js/animator/react';
import type { Fill } from '@weasel-js/core';
import { Button } from '@weasel-js/ui/components/Button';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { DemoStage } from './DemoStage';

interface Block { id: string; x: number; y: number; width: number; height: number; fill: Fill }

const W = 400, H = 300, SIZE = 40, INSET = 30;
const ID = asNodeId('block');
const CORNERS = [
  { name: 'top left', x: INSET, y: INSET },
  { name: 'top right', x: W - INSET - SIZE, y: INSET },
  { name: 'bottom left', x: INSET, y: H - INSET - SIZE },
  { name: 'bottom right', x: W - INSET - SIZE, y: H - INSET - SIZE },
];
const START: Block = { id: ID, x: INSET, y: INSET, width: SIZE, height: SIZE, fill: { paint: { color: '#7ab8d4' } } };

export function PoseBlendDemo() {
  const scene = useScene({ items: [START] });
  const adapter = useSceneAdapter(scene);
  const animator = useAnimator();
  const [spring, setSpring] = useState(false);

  // The scene holds the destination from the first frame; only the block on screen travels.
  // A second tweenPose mid-move adds to the first, and a springPose takes over at its speed.
  const send = (x: number, y: number) => {
    const to = { ...scene.get(ID)!.pose, x, y };
    if (spring) springPose(animator, adapter, { id: ID, to, preset: 'wobbly' });
    else tweenPose(animator, adapter, { id: ID, to, ms: 900 });
  };

  return (
    <div>
      <div className="ckd-toolbar">
        {CORNERS.map((c) => (
          <Button key={c.name} onClick={() => send(c.x, c.y)}>{c.name}</Button>
        ))}
        <Checkbox isSelected={spring} onChange={setSpring}>spring</Checkbox>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas className="ckd-canvas" scene={scene} />
      </DemoStage>
    </div>
  );
}
