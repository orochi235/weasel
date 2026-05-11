import { useState, useMemo, useSyncExternalStore } from 'react';
import {
  SceneCanvas,
  sceneFromJSON,
  useSelection,
  textCommand,
} from '@orochi235/weasel';
import type { RegisteredOp, Scene, SerializedScene } from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';
import sceneJson from './data/scene.scene.json';

type LayerId = 'garden' | 'blueprint' | 'structures' | 'zones' | 'plantings';
interface NodeData { color: string; label?: string }
interface Pose { x: number; y: number; width: number; height: number }

const W = 480, H = 320;


interface SetColorPayload { id: string; from: string; to: string }
function makeSetColor(scene: Scene<NodeData, LayerId, Pose>): RegisteredOp<SetColorPayload> {
  return {
    apply: (p) => {
      const n = scene.get(p.id as never);
      if (n) (n as { data: NodeData }).data = { ...n.data, color: p.to };
    },
    revert: (p) => {
      const n = scene.get(p.id as never);
      if (n) (n as { data: NodeData }).data = { ...n.data, color: p.from };
    },
  };
}

export function SceneDemo() {
  const [scene] = useState(() =>
    sceneFromJSON(sceneJson as unknown as SerializedScene<NodeData, LayerId, Pose>, {}),
  );
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  useMemo(() => {
    scene.registerOp<SetColorPayload>('setColor', makeSetColor(scene));
  }, [scene]);

  const selection = useSelection();

  const recolorSelection = () => {
    const ids = selection.get();
    if (ids.length === 0) return;
    scene.batch('recolor', () => {
      for (const id of ids) {
        const n = scene.get(id as never);
        if (!n) continue;
        const next = `hsl(${Math.floor(Math.random() * 360)} 60% 65%)`;
        scene.recordOp({ kind: 'setColor', payload: { id, from: n.data.color, to: next } });
      }
    });
  };

  return (
    <div tabIndex={0} style={{ outline: 'none' }}>
      <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => scene.undo()} disabled={!scene.canUndo()}>Undo</button>
        <button onClick={() => scene.redo()} disabled={!scene.canRedo()}>Redo</button>
        <button onClick={recolorSelection}>Recolor selection</button>
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
        geometry={{
          pickEvery: (wx, wy) => {
            const ordered = [...scene.renderOrder()];
            for (let i = ordered.length - 1; i >= 0; i--) {
              const id = ordered[i];
              if (id === 'garden-bg') continue;
              const n = scene.get(id);
              if (!n) continue;
              const { x, y, width, height } = n.pose;
              if (wx >= x && wx <= x + width && wy >= y && wy <= y + height) return id;
            }
            return null;
          },
        }}
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
