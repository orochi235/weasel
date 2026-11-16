import { useCallback } from 'react';
import { circlePath, pathDivide, pathExclude, pathIntersect, pathSubtract, pathUnion, polygonFromPoints, SceneCanvas, solid, useScene, useSelection, WeaselProvider, pathNode } from '@weasel-js/core';
import type { Fill, PolygonPath, RectPose } from '@weasel-js/core';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { Button } from '@weasel-js/ui/components/Button';
import { Sequence, values } from '@weasel-js/ui/components/Sequence';
import { DemoStage, DemoStageGroup } from './DemoStage';
import { pathfinderPreset, pickPreset } from '@weasel-js/editing';

const W = 240;
const H = 200;

const RECT_INPUT = polygonFromPoints([{ x: 40, y: 50 }, { x: 140, y: 50 }, { x: 140, y: 140 }, { x: 40, y: 140 }]);
const CIRCLE_INPUT = circlePath(120, 115, 55);

const RECT_COLOR = '#7fb069';
const CIRCLE_COLOR = '#d4a574';
const RESULT_COLOR = '#a48bd4';
const DIVIDE_COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#7ab8d4', '#d47a7a'];

interface PanelItem {
  id: string;
  path: PolygonPath;
  color: string;
}

type Data = { path: PolygonPath; fill: Fill };

/** A path leaf as the shape tools mint one: the path in `data.path`, drawn through the box its pose
 *  describes, so the kit paints it and the booleans adapter `<SceneCanvas>` publishes works on it. */
const pathLeaf = ({ id, path, color }: PanelItem) => pathNode(id, path, { fill: { paint: solid(color) } });

const INPUTS = [
  { id: 'rect', path: RECT_INPUT, color: RECT_COLOR },
  { id: 'circle', path: CIRCLE_INPUT, color: CIRCLE_COLOR },
];
const INITIAL_NODES = INPUTS.map(pathLeaf);
const INPUT_IDS = INITIAL_NODES.map((n) => n.id);

function Panel({ paths }: { paths: PanelItem[] }) {
  const scene = useScene<Data, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: paths.map(pathLeaf),
  });
  return (
    <WeaselProvider isolate>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          className="ckd-canvas"
          scene={scene}
          selectionOptions={{ mode: 'multi' }}
          layers={{ selectionOverlay: { outline: { follow: 'shape' } } }}
        />
      </DemoStage>
    </WeaselProvider>
  );
}

function InteractivePanel() {
  const scene = useScene<Data, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: INITIAL_NODES,
  });
  const selection = useSelection({ scene, mode: 'multi', initial: INPUT_IDS });

  const reset = useCallback(() => {
    scene.batch('Reset', () => {
      scene.removeMany([...scene.roots]);
      for (const node of INITIAL_NODES) scene.add(node);
    });
    selection.set(INPUT_IDS);
  }, [scene, selection]);

  return (
    <div className="ckd-boolops-panel">
      <h3 className="ckd-boolops-label">Interactive</h3>
      <div className="ckd-boolops-toolbar">
        <ActionBar group="pathfinder" />
        <Button className="ckd-boolops-reset" onClick={reset}>Reset</Button>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas features={[pickPreset, pathfinderPreset]}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          layers={{ selectionOverlay: { outline: { follow: 'shape' } } }}
        />
      </DemoStage>
    </div>
  );
}

/** Each op applied to the same two inputs, one static canvas apiece. */
const STATIC: { label: string; paths: PanelItem[] }[] = [
  { label: 'Inputs', paths: INPUTS },
  { label: 'Union', paths: [{ id: 'u', path: pathUnion(RECT_INPUT, CIRCLE_INPUT), color: RESULT_COLOR }] },
  { label: 'Intersect', paths: [{ id: 'i', path: pathIntersect(RECT_INPUT, CIRCLE_INPUT), color: RESULT_COLOR }] },
  { label: 'Subtract', paths: [{ id: 's', path: pathSubtract(RECT_INPUT, CIRCLE_INPUT), color: RESULT_COLOR }] },
  { label: 'Exclude', paths: [{ id: 'x', path: pathExclude(RECT_INPUT, CIRCLE_INPUT), color: RESULT_COLOR }] },
  {
    label: 'Divide',
    paths: pathDivide(RECT_INPUT, CIRCLE_INPUT).map((path, i) => ({ id: `d${i}`, path, color: DIVIDE_COLORS[i % DIVIDE_COLORS.length] })),
  },
];

export function BooleanOpsDemo() {
  return (
    <DemoStageGroup>
      <div className="ckd-demo">
        {/* Isolated so the pathfinder bar reaches this canvas's actions, and its initial selection does
            not fight the static panels' empty ones. */}
        <WeaselProvider isolate>
          <InteractivePanel />
        </WeaselProvider>
        <Sequence label="Each op on the inputs" sweep={values(STATIC, (op) => op.label)}>
          {(op) => <Panel paths={op.paths} />}
        </Sequence>
      </div>
    </DemoStageGroup>
  );
}
