import { useCallback, useMemo } from 'react';
import {
  asNodeId,
  boundsOfPath,
  circlePath,
  pathDivide,
  pathExclude,
  pathInPoseFrame,
  pathIntersect,
  pathSubtract,
  pathUnion,
  polygonFromPoints,
  SceneCanvas,
  useScene,
  useSelection,
  useStandardActions,
  WeaselProvider,
} from '@weasel-js/core';
import type { PolygonPath, RectPose } from '@weasel-js/core';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { Button } from '@weasel-js/ui/components/Button';
import { DemoStage, DemoStageGroup } from './DemoStage';

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

/** The interactive panel's inputs, by id; a node with any other id is a result. */
const INPUT_COLORS: Record<string, string> = { rect: RECT_COLOR, circle: CIRCLE_COLOR };

// Path leaves as the kit reads them: the path in `data.path`, drawn through the box its pose describes, so
// the booleansAdapter <SceneCanvas> publishes works on them.
const INITIAL_NODES = [
  { id: 'rect', path: RECT_INPUT },
  { id: 'circle', path: CIRCLE_INPUT },
].map(({ id, path }) => ({
  kind: 'mark' as const,
  layer: 'default' as const,
  id: asNodeId(id),
  pose: boundsOfPath(path) as RectPose,
  data: { path },
}));

function Panel({ id, paths }: { id: string; paths: PanelItem[] }) {
  const scene = useScene<PanelItem>({ items: paths });
  return (
    <WeaselProvider isolate>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          className="ckd-canvas"
          scene={scene}
          selectionOptions={{ mode: 'multi' }}
          layers={{
            scene: {
              drawOne: (node): DrawCommand[] => [{
                kind: 'path',
                path: node.data.path,
                fill: { paint: { color: node.data.color } },
              }],
            },
            selectionOverlay: { outline: { follow: 'shape' } },
          }}
          data-panel={id}
        />
      </DemoStage>
    </WeaselProvider>
  );
}

function InteractivePanel() {
  const scene = useScene<{ path: PolygonPath }, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: INITIAL_NODES,
  });

  const selection = useSelection({
    scene,
    mode: 'multi',
    initial: [asNodeId('rect'), asNodeId('circle')],
  });

  // Register the kit-standard action descriptors, pathfinder.* among them, with the ambient ActionsProvider.
  // Their invokers reach the booleansAdapter <SceneCanvas> publishes over this scene. Together these power
  // the <ActionBar group="pathfinder"/> below.
  useStandardActions({ selection });

  const reset = useCallback(() => {
    scene.batch('Reset', () => {
      scene.removeMany([...scene.roots]);
      for (const node of INITIAL_NODES) scene.add(node);
    });
    selection.set([asNodeId('rect'), asNodeId('circle')]);
  }, [scene, selection]);

  return (
    <div className="ckd-boolops-panel">
      <h3 className="ckd-boolops-label">Interactive</h3>
      <div className="ckd-boolops-toolbar">
        <ActionBar group="pathfinder" />
        <Button className="ckd-boolops-reset" onClick={reset}>Reset</Button>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas features={['pick']}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          layers={{
            scene: {
              drawOne: (node, pose): DrawCommand[] => [{
                kind: 'path',
                path: pathInPoseFrame(node.data.path, pose),
                fill: { paint: { color: INPUT_COLORS[node.id] ?? RESULT_COLOR } },
              }],
            },
            selectionOverlay: { outline: { follow: 'shape' } },
          }}
          data-panel="interactive"
        />
      </DemoStage>
    </div>
  );
}

export function BooleanOpsDemo() {
  const unionResult = useMemo(() => pathUnion(RECT_INPUT, CIRCLE_INPUT), []);
  const intersectResult = useMemo(() => pathIntersect(RECT_INPUT, CIRCLE_INPUT), []);
  const subtractResult = useMemo(() => pathSubtract(RECT_INPUT, CIRCLE_INPUT), []);
  const excludeResult = useMemo(() => pathExclude(RECT_INPUT, CIRCLE_INPUT), []);
  const divideResults = useMemo(() => pathDivide(RECT_INPUT, CIRCLE_INPUT), []);

  const dividePaths = useMemo(
    () => divideResults.map((p, i) => ({
      id: `d${i}`,
      path: p,
      color: DIVIDE_COLORS[i % DIVIDE_COLORS.length],
    })),
    [divideResults],
  );

  return (
    <DemoStageGroup>
      <div className="ckd-boolops-grid">
        {/* The scope sits above InteractivePanel, not inside it: its
            useStandardActions hook registers into the actions and dep
            registries before its SceneCanvas mounts, so they have to be in
            scope by the time they fire. Isolated because this canvas's non-empty
            initial selection would otherwise fight the static panels' empty
            ones. */}
        <WeaselProvider isolate>
          <InteractivePanel />
        </WeaselProvider>

        <div className="ckd-boolops-panel">
          <h3 className="ckd-boolops-label">Inputs</h3>
          <Panel id="inputs" paths={[
            { id: 'rect', path: RECT_INPUT, color: RECT_COLOR },
            { id: 'circle', path: CIRCLE_INPUT, color: CIRCLE_COLOR },
          ]} />
        </div>

        <div className="ckd-boolops-panel">
          <h3 className="ckd-boolops-label">Union</h3>
          <Panel id="union" paths={[{ id: 'u', path: unionResult, color: RESULT_COLOR }]} />
        </div>

        <div className="ckd-boolops-panel">
          <h3 className="ckd-boolops-label">Intersect</h3>
          <Panel id="intersect" paths={[{ id: 'i', path: intersectResult, color: RESULT_COLOR }]} />
        </div>

        <div className="ckd-boolops-panel">
          <h3 className="ckd-boolops-label">Subtract</h3>
          <Panel id="subtract" paths={[{ id: 's', path: subtractResult, color: RESULT_COLOR }]} />
        </div>

        <div className="ckd-boolops-panel">
          <h3 className="ckd-boolops-label">Exclude</h3>
          <Panel id="exclude" paths={[{ id: 'x', path: excludeResult, color: RESULT_COLOR }]} />
        </div>

        <div className="ckd-boolops-panel">
          <h3 className="ckd-boolops-label">Divide</h3>
          <Panel id="divide" paths={dividePaths} />
        </div>
      </div>
    </DemoStageGroup>
  );
}
