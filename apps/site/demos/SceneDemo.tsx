import { useState, useSyncExternalStore } from 'react';
import { SceneCanvas, sceneFromJSON, useSelection } from '@weasel-js/core';
import type { FillStyle, SerializedScene } from '@weasel-js/core';
import sceneJson from './data/scene.scene.json';

interface NodeData { fill: FillStyle; label?: string }
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
        <button onClick={() => scene.undo()} disabled={!scene.canUndo()}>Undo</button>
        <button onClick={() => scene.redo()} disabled={!scene.canRedo()}>Redo</button>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          Cmd/Ctrl+Z undo · Shift+Cmd/Ctrl+Z redo · drag rects to move
        </span>
      </div>
      <SceneCanvas
        width={480}
        height={320}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        backgroundFill={{ color: '#f4e9d8' }}
        defaultTools={['select']}
        layers={{ selectionOverlay: { handles: false } }}
      />
    </div>
  );
}
