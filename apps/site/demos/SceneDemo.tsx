import { useState } from 'react';
import { SceneCanvas, WeaselProvider, sceneFromJSON, useSelection, editPreset, movePreset, pickPreset } from '@weasel-js/core';
import type { SerializedScene, Fill, RectPose } from '@weasel-js/core';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import sceneJson from './data/scene.scene.json';
import { DemoStage } from './DemoStage';

interface NodeData { fill?: Fill; label?: string }

export function SceneDemo() {
  return <WeaselProvider><SceneFromJson /></WeaselProvider>;
}

function SceneFromJson() {
  const [scene] = useState(() =>
    sceneFromJSON(sceneJson as unknown as SerializedScene<NodeData, string, RectPose>, {}),
  );
  const selection = useSelection({ scene });

  return (
    <div>
      <ActionBar group="history" />
      <DemoStage width={480} height={320}>
        <SceneCanvas
          features={[pickPreset, movePreset, editPreset]}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          backgroundFill={{ color: '#f4e9d8' }}
        />
      </DemoStage>
    </div>
  );
}
