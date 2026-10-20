import { type ActionTunings, PathBuilder, type RectPose } from '@weasel-js/core';
import { ANCHOR_SELECTION_GROUP, anchorSelectionPreset } from '@weasel-js/path-tools';
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
import { createPathLabScene, useSeededPathEdit } from './pathEditLabSeed';
import { OpeningSteps, PathLabStage } from './pathLab/pathLab';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const config = f.schema({
  n: f.number(4).range(2, 8).step(1).label('Every Nth: N'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** A closed flower: smooth petal tips between corner notches, 16 anchors. */
function flower() {
  const b = new PathBuilder();
  const cx = 300, cy = 220, inner = 70, outer = 170, petals = 8;
  const at = (r: number, a: number) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  const step = (Math.PI * 2) / petals;
  const start = at(inner, 0);
  b.moveTo(start.x, start.y);
  for (let k = 0; k < petals; k++) {
    const tipAngle = (k + 0.5) * step;
    const tip = at(outer, tipAngle);
    // The tip's handles run along the rim, so it is smooth.
    const h = 45;
    const tx = -Math.sin(tipAngle) * h, ty = Math.cos(tipAngle) * h;
    const notch = at(inner, (k + 1) * step);
    const from = at(inner, k * step);
    b.curveTo(from.x, from.y, tip.x - tx, tip.y - ty, tip.x, tip.y);
    b.curveTo(tip.x + tx, tip.y + ty, notch.x, notch.y, notch.x, notch.y);
  }
  return b.close().build();
}

const createLabScene = () => createPathLabScene(flower(), '#f2c6de');
const features = ['draw', anchorSelectionPreset] as const;

function AnchorSelectTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { selection, pathEdit, redrawOn } = useSeededPathEdit();
  const { n } = ctx.config;
  const tune = useMemo<ActionTunings>(() => ({ selectEveryNthAnchor: { params: { n } } }), [n]);
  return (
    <PathLabStage bar={<ActionBar group={ANCHOR_SELECTION_GROUP} />}>
      <TrialSceneCanvas
        features={features}
        scene={scene}
        trial={ctx.trial}
        selection={selection}
        pathEdit={pathEdit}
        redrawOn={redrawOn}
        tune={tune}
      />
      <OpeningSteps steps={[['selectEveryNthAnchor']]} />
    </PathLabStage>
  );
}

const instrument = defineInstrument<State, Config>({
  name: 'Anchor selection',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' }] },
  render: (ctx) => <AnchorSelectTrial ctx={ctx} />,
});

export function AnchorSelectLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Anchor selection along a path" instruments={[instrument]} defaultInstrument="Anchor selection" />
    </div>
  );
}
