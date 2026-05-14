import { useState, useSyncExternalStore } from 'react';
import { SceneCanvas, sceneFromJSON, useSelection } from '@orochi235/weasel';
import type { SerializedScene } from '@orochi235/weasel';
import sceneJson from './data/scene.scene.json';

type LayerId = 'garden' | 'blueprint' | 'structures' | 'zones' | 'plantings';
interface NodeData { color: string; label?: string }
interface Pose { x: number; y: number; width: number; height: number }

const W = 480, H = 320;

// `<SceneCanvas>`'s scene-slot `drawOne` defaults to a rect-fill keyed
// off `node.data.color` plus a top-left label keyed off `node.data.label`
// — exactly what this demo needs. Custom `drawOne` is only required when
// rendering shapes the default doesn't know about (paths, polygons,
// icons, etc.) or when you want layer-wide decorations beyond fill+label.
export function SceneDemo() {
  const [scene] = useState(() =>
    sceneFromJSON(sceneJson as unknown as SerializedScene<NodeData, LayerId, Pose>, {}),
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
        width={W}
        height={H}
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
