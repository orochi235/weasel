import { SceneCanvas, solid, useScene, useSelection, movePreset, pickPreset, pathNode } from '@weasel-js/core';
import { pathsPreset } from '@weasel-js/path-tools';
import { DemoStage } from './DemoStage';

const W = 480, H = 300;

const filledNode = (id: string, d: string, color: string) => pathNode(id, d, { fill: { paint: solid(color) } });

export function PathAnchorEditDemo() {
  const scene = useScene({
    systemLayers: [{ id: 'default' }],
    initial: [
      filledNode('kite', 'M140 40 L220 140 L140 260 L60 140 Z', '#7fb069'),
      filledNode('wave', 'M280 200 C300 60 400 60 420 200 Z', '#e0a458'),
    ],
  });
  const selection = useSelection({ scene });

  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas features={[pickPreset, movePreset, pathsPreset]}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
      />
    </DemoStage>
  );
}
