import { solid } from '@weasel-js/paint';
import { asNodeId, SceneCanvas, useScene, WeaselProvider, type ActionTunings, type Fill } from '@weasel-js/core';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { DemoStage } from './DemoStage';
import { useSelection } from '@weasel-js/editing';
import * as presets from '@weasel-js/editing/presets';
import * as groups from '@weasel-js/editing/groups';

/** The kit's default painter fills a rect-posed node with its `data.fill`. */
interface NodeData { fill: Fill }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 460, H = 260;
const SIZE = 90;
const COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#7ab8d4', '#d47a7a', '#e0c35c'];
const TILES = COLORS.map((color, i) => ({
  id: asNodeId(`tile${i}`),
  kind: 'mark' as const,
  layer: 'default' as const,
  pose: { x: 40 + (i % 3) * (SIZE + 40), y: 30 + Math.floor(i / 3) * (SIZE + 30), width: SIZE, height: SIZE },
  data: { fill: { paint: solid(color) } },
}));

/** A drag held still over another tile for a second arms the swap. */
const TUNE: ActionTunings = { move: { params: { swapOnDrop: 'dwell' } } };

export function SwapDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({ systemLayers: [{ id: 'default' }], initial: TILES });
  const selection = useSelection({ scene, mode: 'multiple' });
  return (
    // Isolated so the bar reaches this canvas's swap action.
    <WeaselProvider isolate>
      <div className="ckd-toolbar">
        <ActionBar group={groups.swap} />
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          features={[presets.pick, presets.move, presets.swap]}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          tune={TUNE}
        />
      </DemoStage>
    </WeaselProvider>
  );
}
