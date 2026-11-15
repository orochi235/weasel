import {
  SceneCanvas,
  useScene,
  useSelection,
  defaultNodeRouting,
  defaultNodeProperties,
  solid,
  strokeOf, editPreset, pickPreset, asNodeId,
} from '@weasel-js/core';
import type { Stroke, Fill, RectPose } from '@weasel-js/core';
import { SelectionPanel } from '@weasel-js/ui/components/inspector/SelectionPanel';
import { DemoStage } from './DemoStage';

/** `kind` routes the node to its properties; `shape` is what the kit's shape painter draws. */
interface NodeData { kind: string; shape: string; fill: Fill; stroke?: Stroke }
type LayerId = 'default';

const W = 460, H = 320;

export function SelectionPanelDemo() {
  const scene = useScene<NodeData, LayerId, RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: asNodeId('a'), kind: 'mark', layer: 'default', pose: { x: 60, y: 50, width: 120, height: 80 }, data: { kind: 'rect', shape: 'rect', fill: { paint: solid('#7fb069ff') } } },
      { id: asNodeId('b'), kind: 'mark', layer: 'default', pose: { x: 240, y: 90, width: 90, height: 90 }, data: { kind: 'ellipse', shape: 'ellipse', fill: { paint: solid('#d98f6fff') }, stroke: strokeOf('#5a3d2bff', 2) } },
      { id: asNodeId('c'), kind: 'mark', layer: 'default', pose: { x: 130, y: 190, width: 140, height: 70 }, data: { kind: 'rect', shape: 'rect', fill: { paint: solid('#6f9fd9ff') } } },
    ],
  });
  const selection = useSelection({ scene, mode: 'multi' });

  return (
    <div className="ckd-row">
      <DemoStage width={W} height={H}>
        <SceneCanvas
          features={[pickPreset, editPreset]}
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
