import { useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
} from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';
import type { View } from '../../src/core/viewport/view';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;

export function PanDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'a' as never, kind: 'leaf', layer: 'default',
        pose: { x:  50, y:  50, width: 80, height: 60 }, data: { color: '#7fb069' } },
      { id: 'b' as never, kind: 'leaf', layer: 'default',
        pose: { x: 300, y: 200, width: 80, height: 60 }, data: { color: '#a48bd4' } },
      { id: 'c' as never, kind: 'leaf', layer: 'default',
        pose: { x: 600, y: 400, width: 80, height: 60 }, data: { color: '#f0e0a8' } },
    ],
  });
  const selection = useSelection();

  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace' }}>view: ({view.x.toFixed(0)}, {view.y.toFixed(0)})</span>
        <button onClick={() => setView({ x: 0, y: 0, scale: { x: 1, y: 1 } })}>Reset view</button>
        <span style={{ color: '#888' }}>H = hand · space (hold) = momentary hand</span>
      </div>
      <SceneCanvas
        width={W}
        height={H}
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
          selectionOverlay: { handles: false },
        }}
      />
    </div>
  );
}
