import { useState, useSyncExternalStore } from 'react';
import { SceneCanvas, WeaselProvider, sceneFromJSON, useSelection, editPreset, movePreset, pickPreset } from '@weasel-js/core';
import type { SerializedScene, Fill } from '@weasel-js/core';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import sceneJson from './data/scene.scene.json';
import { DemoStage } from './DemoStage';

interface NodeData { fill?: Fill; label?: string }
interface Pose { x: number; y: number; width: number; height: number }

export function SceneDemo() {
  return <WeaselProvider><SceneFromJson /></WeaselProvider>;
}

function SceneFromJson() {
  const [scene] = useState(() =>
    sceneFromJSON(sceneJson as unknown as SerializedScene<NodeData, string, Pose>, {}),
  );
  // An action's `enabled` reads history through a thunk nothing watches, so the bar re-reads on each edit.
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);
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
      <p className="ckd-hint">Drag a rectangle to move it. Cmd/Ctrl+Z undoes, Shift+Cmd/Ctrl+Z redoes.</p>
    </div>
  );
}
