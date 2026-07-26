import { useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  defaultNodeRouting,
  defaultNodeProperties,
  PATH_M,
  PATH_L,
  PATH_Z,
} from '@weasel-js/core';
import type { PolygonPath } from '@weasel-js/core';
import { SelectionPanel } from '@weasel-js/ui';
import type { DrawCommand } from '../../../packages/core/src/renderer';
import type { View } from '../../../packages/core/src/core/viewport/view';

interface NodeData { kind: string; fill: string; stroke?: string; strokeWidth?: number }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number; rotation?: number }

const W = 460, H = 320;

/** 32-gon ellipse approximation inscribed in a pose's box. */
function ellipse(cx: number, cy: number, rx: number, ry: number, n = 32): PolygonPath {
  const commands = new Uint8Array(n + 1);
  const coords = new Float32Array(n * 2);
  commands[0] = PATH_M;
  for (let i = 1; i < n; i++) commands[i] = PATH_L;
  commands[n] = PATH_Z;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    coords[i * 2] = cx + Math.cos(t) * rx;
    coords[i * 2 + 1] = cy + Math.sin(t) * ry;
  }
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

export function SelectionPanelDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'a' as never, kind: 'leaf', layer: 'default', pose: { x: 60, y: 50, width: 120, height: 80 }, data: { kind: 'rect', fill: '#7fb069ff' } },
      { id: 'b' as never, kind: 'leaf', layer: 'default', pose: { x: 240, y: 90, width: 90, height: 90 }, data: { kind: 'ellipse', fill: '#d98f6fff', stroke: '#5a3d2bff', strokeWidth: 2 } },
      { id: 'c' as never, kind: 'leaf', layer: 'default', pose: { x: 130, y: 190, width: 140, height: 70 }, data: { kind: 'rect', fill: '#6f9fd9ff' } },
    ],
  });
  const selection = useSelection({ mode: 'multi' });
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  return (
    <div className="ckd-row">
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectionMode="multi"
        routing={defaultNodeRouting}
        view={view}
        onViewChange={setView}
        viewport={{}}
        layers={{
          scene: {
            // The renderer's Path union has no ellipse variant, so an
            // 'ellipse'-kind node paints as a 32-gon polygon approximation
            // (see `ellipse` above) inscribed in its pose box.
            drawOne: (n, p): DrawCommand[] => [{
              kind: 'path',
              path: n.data.kind === 'ellipse'
                ? ellipse(p.x + p.width / 2, p.y + p.height / 2, p.width / 2, p.height / 2)
                : { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: n.data.fill },
              ...(n.data.stroke ? { stroke: { paint: { color: n.data.stroke }, width: n.data.strokeWidth ?? 1 } } : {}),
            }],
          },
          selectionOverlay: {},
        }}
      />
      <SelectionPanel
        scene={scene}
        selection={selection}
        properties={defaultNodeProperties}
        routing={defaultNodeRouting}
        emptyState={<em>Click a shape (shift-click for multi)</em>}
        className="ckd-panel"
      />
    </div>
  );
}
