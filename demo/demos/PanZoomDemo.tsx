import { useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  meanScale,
} from '@weasel-js/core';
import type { DrawCommand } from '../../src/renderer';
import type { View } from '../../src/core/viewport/view';

interface NodeData { color: string; pin: 'screen' | 'world' | 'none' }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;

/**
 * Viewport navigation in one place: pan via the hand tool (H = sticky, hold
 * space = momentary) and the wheel-pan tool, zoom via ctrl/⌘+wheel and the
 * keyboard (⌘+= / ⌘+- / ⌘+0). The rects spread across a coordinate range far
 * larger than the 400×300 viewport so panning has somewhere to go. The two
 * center rects show the stroke trade-off under zoom: the green one divides its
 * line width by `meanScale(view.scale)` (screen-pinned — constant pixel width
 * at every zoom), the purple one uses a plain world-px stroke (grows and
 * shrinks with the zoom).
 */
export function PanZoomDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'screen-pin' as never, kind: 'leaf', layer: 'default',
        pose: { x: 130, y: 110, width: 120, height: 90 }, data: { color: '#7fb069', pin: 'screen' } },
      { id: 'world-pin' as never, kind: 'leaf', layer: 'default',
        pose: { x: 290, y: 110, width: 120, height: 90 }, data: { color: '#a48bd4', pin: 'world' } },
      { id: 'far-a' as never, kind: 'leaf', layer: 'default',
        pose: { x: -180, y: -120, width: 80, height: 60 }, data: { color: '#d4a574', pin: 'none' } },
      { id: 'far-b' as never, kind: 'leaf', layer: 'default',
        pose: { x: 560, y: 360, width: 80, height: 60 }, data: { color: '#f0e0a8', pin: 'none' } },
    ],
  });
  const selection = useSelection();

  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        <span className="ckd-readout">
          view: ({view.x.toFixed(0)}, {view.y.toFixed(0)}) · scale: ({view.scale.x.toFixed(2)}, {view.scale.y.toFixed(2)})
        </span>
        <button onClick={() => setView({ x: 0, y: 0, scale: { x: 1, y: 1 } })}>Reset view</button>
        <span className="ckd-toolbar-note">
          H = hand · hold space = momentary · ctrl/⌘+wheel zoom · plain wheel pan · ⌘+= / ⌘+- / ⌘+0
        </span>
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
                ...(n.data.pin === 'none'
                  ? {}
                  : { stroke: { paint: { color: '#d4c4a8' }, width: lineWidth } }),
              }];
            },
          },
          selectionOverlay: { handles: false },
        }}
      />
    </div>
  );
}
