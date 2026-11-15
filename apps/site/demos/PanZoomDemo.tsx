import { useState } from 'react';
import { SceneCanvas, solid, useScene, useSelection, viewPreset } from '@weasel-js/core';
import type { Fill, Stroke, View } from '@weasel-js/core';
import num from '@weasel-js/theme/numeric.module.css';
import { Button } from '@weasel-js/ui/components/Button';
import { DemoStage } from './DemoStage';

interface NodeData { fill: Fill; stroke?: Stroke }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;
const EDGE = solid('#d4c4a8');

export function PanZoomDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      // A `{ px }` width stays the same on screen at every zoom; a plain number is world units.
      { id: 'screen-pin' as never, kind: 'mark', layer: 'default',
        pose: { x: 130, y: 110, width: 120, height: 90 },
        data: { fill: { paint: solid('#7fb069') }, stroke: { paint: EDGE, width: { px: 2 } } } },
      { id: 'world-pin' as never, kind: 'mark', layer: 'default',
        pose: { x: 290, y: 110, width: 120, height: 90 },
        data: { fill: { paint: solid('#a48bd4') }, stroke: { paint: EDGE, width: 2 } } },
      { id: 'far-a' as never, kind: 'mark', layer: 'default',
        pose: { x: -180, y: -120, width: 80, height: 60 }, data: { fill: { paint: solid('#d4a574') } } },
      { id: 'far-b' as never, kind: 'mark', layer: 'default',
        pose: { x: 560, y: 360, width: 80, height: 60 }, data: { fill: { paint: solid('#f0e0a8') } } },
    ],
  });
  const selection = useSelection({ scene });

  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        <Button onClick={() => setView({ x: 0, y: 0, scale: { x: 1, y: 1 } })}>Reset view</Button>
        <span className={`ckd-readout ${num.numeric}`}>
          view: ({view.x.toFixed(0)}, {view.y.toFixed(0)}) · scale: ({view.scale.x.toFixed(2)}, {view.scale.y.toFixed(2)})
        </span>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas features={[viewPreset]}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          defaultActiveTool="hand"
          view={view}
          onViewChange={setView}
        />
      </DemoStage>
    </div>
  );
}
