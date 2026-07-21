import { useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  defaultNodeRouting,
  defaultNodeProperties,
} from '@weasel-js/core';
import { SelectionPanel } from '@weasel-js/ui';
import type { DrawCommand } from '../../../src/renderer';
import type { View } from '../../../src/core/viewport/view';

interface NodeData { kind: string; fill: string; stroke?: string; strokeWidth?: number }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number; rotation?: number }

const W = 460, H = 320;

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
            // The renderer's Path union has no ellipse variant — every node
            // paints as a rect regardless of its routing kind. Node "b" keeps
            // data.kind: 'ellipse' so the panel still demonstrates a mixed-
            // kind selection (see the SelectionPanel below).
            drawOne: (n, p): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
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
