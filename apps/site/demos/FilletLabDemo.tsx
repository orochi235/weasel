import { solid } from '@weasel-js/paint';
import { type ActionTunings, asNodeId, createScene, pathFromD, type PolygonPath, type RectPose, withCorner, pathNode } from '@weasel-js/core';
import {
  type ConfigOf,
  defineInstrument,
  f,
  Lab,
  type RenderContext,
  type SceneTrialState,
  TrialSceneCanvas,
  useTrialScene,
} from '@weasel-js/labkit';
import { createPathEditHost, FILLET_CONTROLS, filletPreset, pathsPreset, usePenTool } from '@weasel-js/path-tools';
import { useMemo, useState } from 'react';
import { FilletPanel } from './FilletPanel';
import s from './FilletLabDemo.module.css';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';
import { drawPreset } from '@weasel-js/editing';

// The fillet controls read the selection, so they sit over the canvas
// rather than in the trial's config.
const config = f.schema({});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** The path open for anchor editing as the lab starts, and its selected
 *  anchor: the sharp corner at (220, 140). */
const FIRST = 'tile';
const FIRST_ANCHORS: ReadonlySet<number> = new Set([2]);

const filledNode = (id: string, path: PolygonPath, color: string, vertexColors?: number[]) =>
  pathNode(id, path, { fill: { paint: solid(color) }, ...(vertexColors ? { vertexColors } : {}) });

const tile = [
  [1, { shape: 'round', radius: 24 }],
  [3, { shape: 'bevel', radius: 18 }],
  [4, { shape: 'scoop', radius: 20 }],
] as const;

const createLabScene = () =>
  createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      filledNode(FIRST, tile.reduce<PolygonPath>(
        (p, [i, spec]) => withCorner(p, i, spec),
        pathFromD('M60 60 L220 60 L220 140 L160 200 L60 200 Z'),
      ), '#7fb069'),
      filledNode('petal', withCorner(
        pathFromD('M280 60 C340 40 400 80 420 120 L400 220 C340 230 300 200 280 160 Z'),
        1, { shape: 'squircle', radius: 26 },
      ), '#d4a574'),
      filledNode('prism', withCorner(
        pathFromD('M120 260 L260 260 L190 380 Z'),
        2, { shape: 'round', radius: 30 },
      ), '#ffffff', [1, 0.3, 0.3, 1, 0.3, 0.6, 1, 1, 0.4, 0.9, 0.4, 1]),
    ],
  });

const FEATURES = [drawPreset, pathsPreset, filletPreset] as const;
const TUNE: ActionTunings = { cycleFillet: { bindings: [{ kind: 'key', key: 'k' }] } };

function FilletsTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const pen = usePenTool();
  const scene = useTrialScene(ctx, createLabScene);
  // Held beside the trial so the lab opens on one corner and its panel can read it.
  const [host] = useState(() => createPathEditHost({ id: FIRST, anchors: FIRST_ANCHORS }));
  const selectionOptions = useMemo(() => ({ initial: [asNodeId(FIRST)] }), []);
  return (
    <div className={s.frame}>
      <TrialSceneCanvas
        features={FEATURES}
        tools={{ pen }}
        scene={scene}
        trial={ctx.trial}
        pathEdit={host}
        selectionOptions={selectionOptions}
        tune={TUNE}
      />
      <FilletPanel scene={scene} selection={host} />
    </div>
  );
}

const filletsInstrument = defineInstrument<State, Config>({
  name: 'Fillets',
  config,
  initialState: () => ({ scene: null }),
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('editing:select') },
      { id: 'pen', label: 'Pen', icon: icon('core:pen') },
    ],
  },
  render: (ctx) => <FilletsTrial ctx={ctx} />,
});

export function FilletLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title={FILLET_CONTROLS.name} instruments={[filletsInstrument]} />
    </div>
  );
}
