import { useState, useSyncExternalStore } from 'react';
import { SceneCanvas, sceneFromJSON, useSelection } from '@weasel-js/core';
import type { SerializedScene, Fill } from '@weasel-js/core';
import { Button } from '@weasel-js/ui/components/Button';
import sceneJson from './data/scene.scene.json';
import { DemoStage } from './DemoStage';

interface NodeData { fill?: Fill; label?: string }
interface Pose { x: number; y: number; width: number; height: number }

export function SceneDemo() {
  const [scene] = useState(() =>
    sceneFromJSON(sceneJson as unknown as SerializedScene<NodeData, string, Pose>, {}),
  );
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  const selection = useSelection();

  return (
    <div tabIndex={0} style={{ outline: 'none' }}>
      <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button onClick={() => scene.undo()} disabled={!scene.canUndo()}>Undo</Button>
        <Button onClick={() => scene.redo()} disabled={!scene.canRedo()}>Redo</Button>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          Cmd/Ctrl+Z undo · Shift+Cmd/Ctrl+Z redo · drag rects to move
        </span>
      </div>
      <DemoStage width={480} height={320}>
        <SceneCanvas
          features={['pick', 'move', 'edit']}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          backgroundFill={{ color: '#f4e9d8' }}
        />
      </DemoStage>
    </div>
  );
}
