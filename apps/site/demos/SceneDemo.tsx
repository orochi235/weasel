import { useState } from 'react';
import { SceneCanvas, WeaselProvider, loadScene, HISTORY_GROUP } from '@weasel-js/core';
import type { SerializedScene, Fill, RectPose } from '@weasel-js/core';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import sceneJson from './data/scene.scene.json';
import { DemoStage } from './DemoStage';
import { useSelection } from '@weasel-js/editing';
import * as presets from '@weasel-js/editing/presets';

interface NodeData { fill?: Fill; label?: string }

export function SceneDemo() {
  return <WeaselProvider><SceneFromJson /></WeaselProvider>;
}

function SceneFromJson() {
  const [scene] = useState(() =>
    loadScene(sceneJson as unknown as SerializedScene<NodeData, string, RectPose>, {}),
  );
  const selection = useSelection({ scene });

  return (
    <div>
      <ActionBar group={HISTORY_GROUP} />
      <DemoStage width={480} height={320}>
        <SceneCanvas
          features={[presets.pick, presets.move, presets.edit]}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          backgroundFill={{ color: '#f4e9d8' }}
        />
      </DemoStage>
    </div>
  );
}
