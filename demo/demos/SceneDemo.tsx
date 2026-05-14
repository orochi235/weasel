import { useState, useSyncExternalStore } from 'react';
import {
  SceneCanvas,
  sceneFromJSON,
  useSelection,
  textCommand,
} from '@orochi235/weasel';
import type { SerializedScene } from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';
import sceneJson from './data/scene.scene.json';

type LayerId = 'garden' | 'blueprint' | 'structures' | 'zones' | 'plantings';
interface NodeData { color: string; label?: string }
interface Pose { x: number; y: number; width: number; height: number }

const W = 480, H = 320;

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
        layers={{
          scene: {
            drawOne: (node, p): DrawCommand[] => {
              const cmds: DrawCommand[] = [
                {
                  kind: 'path',
                  path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                  fill: { color: node.data.color },
                },
                {
                  kind: 'path',
                  path: { kind: 'rect', x: p.x + 0.5, y: p.y + 0.5, width: p.width - 1, height: p.height - 1 },
                  stroke: { paint: { color: 'rgba(0,0,0,0.3)' }, width: 1 },
                },
              ];
              if (node.data.label) {
                cmds.push(textCommand(
                  p.x + 6,
                  p.y + 14,
                  node.data.label,
                  { fontFamily: 'sans-serif', fontSize: 11, fill: { fill: 'solid', color: 'rgba(0,0,0,0.7)' } },
                ));
              }
              return cmds;
            },
          },
          selectionOverlay: { handles: false },
        }}
      />
    </div>
  );
}
