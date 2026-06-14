import { useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  meanScale,
} from '@weasel-js/core';
import type { DrawCommand } from '../../src/renderer';
import type { View } from '../../src/core/viewport/view';

interface NodeData { color: string; pin: 'screen' | 'world' }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;

export function ZoomDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      // Left rect: stroke pinned to 2 screen px (compensates for view.scale).
      { id: 'screen-pin' as never, kind: 'leaf', layer: 'default',
        pose: { x:  60, y: 80, width: 120, height: 90 },
        data: { color: '#7fb069', pin: 'screen' } },
      // Right rect: stroke pinned to 2 world px (grows with zoom).
      { id: 'world-pin' as never, kind: 'leaf', layer: 'default',
        pose: { x: 220, y: 80, width: 120, height: 90 },
        data: { color: '#a48bd4', pin: 'world' } },
    ],
  });
  const selection = useSelection();

  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'monospace' }}>
          view: ({view.x.toFixed(0)}, {view.y.toFixed(0)}) · scale: ({view.scale.x.toFixed(2)}, {view.scale.y.toFixed(2)})
        </span>
        <button onClick={() => setView({ x: 0, y: 0, scale: { x: 1, y: 1 } })}>Reset view</button>
        <span style={{ color: '#888' }}>
          ctrl/⌘+wheel zoom · plain wheel pan · ⌘+= / ⌘+- / ⌘+0 · H drag · space drag
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#d4c4a8' }}>
        <span>Left (green): stroke = 2 / meanScale(view.scale) (screen-pinned)</span>
        <span>Right (purple): stroke = 2 (world-scaled)</span>
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
            drawOne: (n, p, v): DrawCommand[] => {
              const lineWidth = n.data.pin === 'screen' ? 2 / meanScale(v.scale) : 2;
              return [{
                kind: 'path',
                path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                fill: { color: n.data.color },
                stroke: { paint: { color: '#d4c4a8' }, width: lineWidth },
              }];
            },
          },
          selectionOverlay: { handles: false },
        }}
      />
    </div>
  );
}
