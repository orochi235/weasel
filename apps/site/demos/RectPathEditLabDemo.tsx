import { solid } from '@weasel-js/paint';
import { asNodeId, createScene, hasEditablePath, type NodeId, type PathEditHost, rectPath, type RectPose, type Scene, useActionsRegistry } from '@weasel-js/core';
import {
  defineInstrument,
  f,
  Lab,
  type RenderContext,
  type SceneTrialState,
  TrialSceneCanvas,
  useTrialScene,
} from '@weasel-js/labkit';
import { createPathEditHost, pathsPreset, usePenTool } from '@weasel-js/path-tools';
import { Button } from '@weasel-js/ui/components/Button';
import { useEffect, useReducer, useState } from 'react';
import s from './RectPathEditLabDemo.module.css';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';
import { drawPreset } from '@weasel-js/editing';

type Data = { path?: { kind: string }; fill?: unknown };
type State = SceneTrialState<Data, 'default', RectPose>;
type LabScene = Scene<Data, 'default', RectPose>;

const FIRST = asNodeId('rect-1');

const rect = (id: string, x: number, y: number, width: number, height: number, color: string, rotation?: number) => ({
  id: asNodeId(id),
  kind: 'mark' as const,
  layer: 'default' as const,
  pose: { x, y, width, height, ...(rotation ? { rotation } : {}) },
  data: { path: rectPath(0, 0, width, height), fill: { paint: solid(color) } },
});

const createLabScene = () => {
  const scene = createScene<Data, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      rect('rect-1', 60, 60, 140, 90, '#7fb069'),
      rect('rect-2', 260, 80, 110, 110, '#d4a574', 0.35),
      rect('rect-3', 430, 50, 80, 160, '#a48bd4'),
    ],
  });
  scene.setSelection([FIRST]);
  return scene;
};

/** Re-renders on every scene change, selection included. */
function useSceneTick(scene: LabScene, host: { subscribe(l: () => void): () => void }) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => scene.subscribe(tick), [scene]);
  useEffect(() => host.subscribe(tick), [host]);
}

function Panel({ scene, host }: { scene: LabScene; host: PathEditHost }) {
  const selected = scene.getSelection();
  const open = host.editingId();
  const editing = open && selected.includes(asNodeId(open)) ? open : null;
  const target = selected.find((id) => hasEditablePath(scene.get(id)));
  // The buttons run what a double-click and Escape run. With no point, `enterPathEdit` opens the selection's path.
  const actions = useActionsRegistry();
  return (
    <div className={s.panel}>
      <div className={s.buttons}>
        <Button disabled={!target || target === editing} onClick={() => actions?.trigger('enterPathEdit')}>
          Edit path
        </Button>
        <Button disabled={!editing} onClick={() => actions?.trigger('leavePathEdit')}>
          Done
        </Button>
      </div>
      {selected.length === 0 && <p className={s.empty}>Nothing selected</p>}
      <dl className={s.readout} aria-label="Stored path">
        {selected.map((id: NodeId) => (
          <div key={id} className={s.row}>
            <dt>{id}{id === editing ? ' (editing)' : ''}</dt>
            <dd>{scene.get(id)?.data.path?.kind ?? 'none'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RectPathEditTrial({ ctx }: { ctx: RenderContext<State, unknown> }) {
  const pen = usePenTool();
  const scene = useTrialScene(ctx, createLabScene);
  // Held beside the trial so the panel can read which path is open.
  const [host] = useState(() => createPathEditHost({ id: FIRST }));
  useSceneTick(scene, host);
  return (
    <div className={s.trial}>
      <TrialSceneCanvas
        features={[drawPreset, pathsPreset]}
        defaultTools={['rect']}
        tools={{ pen }}
        scene={scene}
        trial={ctx.trial}
        pathEdit={host}
      />
      <Panel scene={scene} host={host} />
    </div>
  );
}

const rectPathEditInstrument = defineInstrument<State, unknown>({
  name: 'Rectangle path edit',
  config: f.schema({}),
  initialState: () => ({ scene: null }),
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('editing:select') },
      { id: 'rect', label: 'Rectangle', icon: icon('editing:rect') },
      { id: 'pen', label: 'Pen', icon: icon('core:pen') },
    ],
  },
  render: (ctx) => <RectPathEditTrial ctx={ctx} />,
});

export function RectPathEditLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Rectangle path edit" instruments={[rectPathEditInstrument]} />
    </div>
  );
}
