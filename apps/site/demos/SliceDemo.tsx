import { solid } from '@weasel-js/paint';
import { ellipsePath, rectPath, SceneCanvas, starPath, useScene, WeaselProvider, type Path, pathNode } from '@weasel-js/core';
import { useSliceTool } from '@weasel-js/path-tools';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { DemoStage } from './DemoStage';
import { editPreset, movePreset, pickPreset, useSelection } from '@weasel-js/editing';

const W = 480, H = 320;

const leaf = (id: string, path: Path, color: string) => {
  // Stroked, so the edge a cut leaves shows between two pieces of one color.
  return pathNode(id, path, { fill: { paint: solid(color) }, stroke: { paint: solid('#1a130d'), width: 1.5 } });
};

const INITIAL = [
  leaf('rect', rectPath(40, 60, 160, 200), '#7ab8d4'),
  leaf('disc', ellipsePath({ x: 230, y: 40, width: 120, height: 120 }), '#d4a574'),
  leaf('star', starPath({ x: 370, y: 220 }, 80, 5, 36, -Math.PI / 2), '#a48bd4'),
];

export function SliceDemo() {
  const slice = useSliceTool();
  // `<SceneCanvas>` publishes the `slice` dep over its own scene, so mounting
  // the tool is all this needs: every cut swaps the paths it crosses for their pieces.
  const scene = useScene({ systemLayers: [{ id: 'default' }], initial: INITIAL });
  const selection = useSelection({ scene, mode: 'multi' });
  return (
    <WeaselProvider>
      <div className="ckd-demo">
        <ToolPalette orientation="horizontal" />
        <DemoStage width={W} height={H}>
          <SceneCanvas
            className="ckd-canvas"
            scene={scene}
            selection={selection}
            features={[pickPreset, movePreset, editPreset]}
            tools={{ slice }}
            defaultActiveTool="slice"
          />
        </DemoStage>
      </div>
    </WeaselProvider>
  );
}
