import { solid, strokeOf } from '@weasel-js/paint';
import { asNodeId, createScene, PATH_EFFECT_DERIVATIONS, pathEffectNode, pathNode, type RectPose, withPathEffectsRegistry } from '@weasel-js/core';
import { pathEffectsPreset, pathsPreset, usePenTool } from '@weasel-js/path-tools';
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
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { PathEffectFrame, usePathEffectProbe, usePathEffectSettings } from './pathEffectLab';
import { icon } from '../icons.gen';
import { drawPreset, useSelection } from '@weasel-js/editing';

const FEATURES = [drawPreset, pathsPreset, pathEffectsPreset] as const;

const config = f.schema({
  fit: f.enum('stretch', ['stretch', 'natural']).label('Fit'),
  baseline: f.number(0.5).range(0, 1).step(0.05).label('Spine runs through'),
  flip: f.boolean(false).label('Flip across the spine'),
  tolerance: f.number(0.5).range(0.1, 4).step(0.1).suffix('px').label('Refit tolerance'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

const settingsOf = (c: Config) => ({ fit: c.fit, baseline: c.baseline, flip: c.flip, tolerance: c.tolerance });

const SPINE = asNodeId('spine');
/** The spine opens in path edit, its anchors up for dragging. */
const OPENING = { id: SPINE };

function createLabScene() {
  const ribbon = pathNode('ribbon', 'M60 40 L220 40 L250 70 L220 100 L60 100 L90 70 Z', {
    fill: { paint: solid('#7fb069') },
    stroke: strokeOf('#3d5a2a', 2),
  });
  const spine = pathNode('spine', 'M80 300 C180 160 300 420 420 260 C500 160 580 200 640 280', {
    fill: null,
    stroke: strokeOf('#8a8a8a', 1),
  });
  const bent = { ...pathEffectNode({ kind: 'bendAlong', ...settingsOf(config.defaults()) }, [ribbon.id, spine.id], 'default', PATH_EFFECT_DERIVATIONS), id: asNodeId('bent') };
  return createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    registry: withPathEffectsRegistry(),
    initial: [ribbon, spine, bent],
  });
}

function BendTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const pen = usePenTool();
  const scene = useTrialScene(ctx, createLabScene);
  const selection = useSelection({ scene, initial: [SPINE] });
  // A bend made from the bar or with Alt+Shift+W takes the panel's settings.
  const tune = usePathEffectSettings(scene, 'bendAlong', ctx.config, settingsOf);
  usePathEffectProbe(scene);

  return (
    <PathEffectFrame>
      <TrialSceneCanvas
        features={FEATURES}
        defaultTools={['rect']}
        tools={{ pen }}
        scene={scene}
        selection={selection}
        trial={ctx.trial}
        defaultPathEdit={OPENING}
        tune={tune}
      />
    </PathEffectFrame>
  );
}

const bendInstrument = defineInstrument<State, Config>({
  name: 'Bend along a path',
  config,
  initialState: () => ({ scene: null }),
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('editing:select') },
      { id: 'rect', label: 'Rectangle', icon: icon('editing:rect') },
      { id: 'pen', label: 'Pen', icon: icon('core:pen') },
    ],
  },
  render: (ctx) => <BendTrial ctx={ctx} />,
});

export function BendAlongLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Bend along a path" instruments={[bendInstrument]} />
    </div>
  );
}
