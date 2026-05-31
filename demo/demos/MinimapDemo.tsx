import { useCallback, useMemo, useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
} from '@orochi235/weasel';
// TODO: switch to '@orochi235/weasel' once step 6 lands
import { MinimapCanvas } from '../../src/canvas/MinimapCanvas';
import type { DrawCommand } from '../../src/renderer';
import type { View } from '../../src/core/viewport/view';
import type { SceneViewDrawOne } from '../../src/canvas/sceneViewRender';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const MAIN_W = 600, MAIN_H = 400;
const MINI_W = 200, MINI_H = 140;

const COLORS: NodeData['color'][] = ['#7fb069', '#a48bd4', '#f0e0a8', '#e07a7a', '#5fb0c2'];

function makeRandomScene() {
  const items = [];
  for (let i = 0; i < 12; i++) {
    items.push({
      id: `n${i}` as never,
      kind: 'leaf' as const,
      layer: 'default' as LayerId,
      pose: {
        x: Math.random() * 1000 - 200,
        y: Math.random() * 800 - 100,
        width: 60 + Math.random() * 60,
        height: 60 + Math.random() * 60,
      },
      data: { color: COLORS[i % COLORS.length] },
    });
  }
  return items;
}

export function MinimapDemo() {
  const initial = useMemo(makeRandomScene, []);
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial,
  });
  const selection = useSelection();
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  // Simplified drawOne for the minimap — AABB fill only, no chrome.
  // Demonstrates the spec's point that minimap drawOnes are typically a
  // stripped-down variant of the main canvas's.
  const minimapDrawOne = useCallback<SceneViewDrawOne<NodeData, LayerId, Pose>>(
    (n, p) => [{
      kind: 'path',
      path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      fill: { fill: 'solid', color: n.data.color },
    }],
    [],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace' }}>
          view: ({view.x.toFixed(0)}, {view.y.toFixed(0)}) ×{view.scale.x.toFixed(2)}
        </span>
        <button onClick={() => setView({ x: 0, y: 0, scale: { x: 1, y: 1 } })}>Reset</button>
        <span style={{ color: '#888' }}>
          H = hand on main · click minimap to recenter · drag minimap to pan
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <SceneCanvas
          width={MAIN_W}
          height={MAIN_H}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          view={view}
          onViewChange={setView}
          viewport={{}}
          layers={{
            scene: {
              drawOne: (n, p): DrawCommand[] => [{
                kind: 'path',
                path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                fill: { color: n.data.color },
              }],
            },
          }}
        />
        <aside
          style={{
            padding: 8,
            border: '1px solid #444',
            background: 'rgba(255,255,255,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Minimap (detached)
          </div>
          <MinimapCanvas
            scene={scene}
            mainView={view}
            mainViewDims={{ width: MAIN_W, height: MAIN_H }}
            onMainViewChange={setView}
            width={MINI_W}
            height={MINI_H}
            drawOne={minimapDrawOne}
            fit="scene"
          />
        </aside>
      </div>
    </div>
  );
}
