import { type ActionTunings, asNodeId, boundsOfPath, createScene, PathBuilder, type PolygonPath, type RectPose, solid } from '@weasel-js/core';
import { bridgePreset, DEFAULT_BRIDGE_TENSION } from '@weasel-js/path-tools';
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
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { useMemo } from 'react';
import s from './BridgeLabDemo.module.css';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const FEATURES = ['draw', bridgePreset] as const;

const config = f.schema({
  tension: f.number(DEFAULT_BRIDGE_TENSION).range(0, 1.5).step(0.05).label('Tension'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

function openPath(id: string, path: PolygonPath, color: string) {
  return {
    id: asNodeId(id),
    kind: 'leaf' as const,
    layer: 'default' as const,
    pose: boundsOfPath(path),
    data: { path, stroke: { paint: solid(color), width: 3 } },
  };
}

/** The two paths the lab opens on, both selected, their facing ends apart. */
export const BRIDGE_SEED = ['arc', 'hook'] as const;

const createLabScene = () =>
  createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      openPath('arc', new PathBuilder().moveTo(60, 300).curveTo(60, 160, 200, 120, 260, 180).build(), '#4a7fd4'),
      openPath('hook', new PathBuilder().moveTo(420, 120).lineTo(420, 260).curveTo(420, 330, 520, 330, 540, 260).build(), '#7fb069'),
      openPath('wire', new PathBuilder().moveTo(120, 400).curveTo(200, 360, 260, 440, 340, 400).build(), '#a48bd4'),
    ],
  });

function BridgeTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { tension } = ctx.config;
  const tune = useMemo<ActionTunings>(() => ({
    bridgePaths: { params: { tension } },
    bridgeAnchors: { params: { tension } },
  }), [tension]);
  const selectionOptions = useMemo(() => ({ mode: 'multi' as const, initial: BRIDGE_SEED.map((id) => asNodeId(id)) }), []);

  return (
    <div className={s.trial}>
      <TrialSceneCanvas
        features={FEATURES}
        defaultTools={['pen']}
        scene={scene}
        trial={ctx.trial}
        tune={tune}
        selectionOptions={selectionOptions}
      />
      <div className={s.actions}>
        <ActionBar group="path" />
        <ActionBar group="anchors" />
      </div>
    </div>
  );
}

const bridgeInstrument = defineInstrument<State, Config>({
  name: 'Bridge',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: 'pen', label: 'Pen', icon: icon('core:pen'), shortcut: 'P' },
    ],
  },
  render: (ctx) => <BridgeTrial ctx={ctx} />,
});

export function BridgeLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Bridge" instruments={[bridgeInstrument]} defaultInstrument="Bridge" />
    </div>
  );
}
