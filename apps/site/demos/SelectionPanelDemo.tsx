import {
  SceneCanvas,
  useScene,
  useSelection,
  defaultNodeRouting,
  defaultNodeProperties,
  solid,
  strokeOf,
} from '@weasel-js/core';
import type { Stroke, Fill } from '@weasel-js/core';
import { SelectionPanel } from '@weasel-js/ui/components/SelectionPanel';
import { DemoStage } from './DemoStage';

/** `kind` routes the node to its properties; `shape` is what the kit's shape painter draws. */
interface NodeData { kind: string; shape: string; fill: Fill; stroke?: Stroke }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number; rotation?: number }

const W = 460, H = 320;

export function SelectionPanelDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'a' as never, kind: 'mark', layer: 'default', pose: { x: 60, y: 50, width: 120, height: 80 }, data: { kind: 'rect', shape: 'rect', fill: { paint: solid('#7fb069ff') } } },
      { id: 'b' as never, kind: 'mark', layer: 'default', pose: { x: 240, y: 90, width: 90, height: 90 }, data: { kind: 'ellipse', shape: 'ellipse', fill: { paint: solid('#d98f6fff') }, stroke: strokeOf('#5a3d2bff', 2) } },
      { id: 'c' as never, kind: 'mark', layer: 'default', pose: { x: 130, y: 190, width: 140, height: 70 }, data: { kind: 'rect', shape: 'rect', fill: { paint: solid('#6f9fd9ff') } } },
    ],
  });
  const selection = useSelection({ scene, mode: 'multi' });

  return (
    <div className="ckd-row">
      <DemoStage width={W} height={H}>
        <SceneCanvas
          features={['pick', 'edit']}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          routing={defaultNodeRouting}
        />
      </DemoStage>
      <SelectionPanel
        scene={scene}
        selection={selection}
        properties={defaultNodeProperties}
        routing={defaultNodeRouting}
        emptyState={<em>Click a shape (Cmd-click for multi)</em>}
        className="ckd-panel ckd-panel-plain"
      />
    </div>
  );
}
