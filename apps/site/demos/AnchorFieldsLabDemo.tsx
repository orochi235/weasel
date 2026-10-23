import {
  asNodeId,
  boundsOfPath,
  createScene,
  pathFromD,
  type RectPose,
  solid,
  useSelection,
} from '@weasel-js/core';
import {
  type ConfigOf,
  defineInstrument,
  f,
  FloatingPanel,
  Lab,
  type RenderContext,
  type SceneTrialState,
  TrialSceneCanvas,
  useTrialScene,
} from '@weasel-js/labkit';
import { AnchorFields } from '@weasel-js/ui/components/AnchorFields';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

/** Document units: points, 72 to the inch. */
const UNITS = { pt: 1, in: 72, mm: 72 / 25.4 };

const config = f.schema({
  handles: f.enum<'xy' | 'polar'>('xy', [
    { value: 'xy', label: 'X / Y' },
    { value: 'polar', label: 'Angle / length' },
  ]).toggle().label('Handles as'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** A leaf: two anchors, joined by a curve either side. */
const LEAF = 'M100 200 C140 110 260 90 340 120 C300 190 200 240 100 200 Z';

const createLabScene = () => {
  const path = pathFromD(LEAF);
  const { x, y, width, height } = boundsOfPath(path);
  return createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [{
      kind: 'mark', id: asNodeId('leaf'), layer: 'default', pose: { x, y, width, height },
      data: { path, fill: { paint: solid('#a8d5a2') }, stroke: { paint: solid('#3f7a3a'), width: 2 } },
    }],
  });
};

/** Opens in path edit with both anchors selected, so X and Y differ between them and read Mixed. */
const OPENING = { id: 'leaf', anchors: [0, 1] };

function FieldsTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const selection = useSelection({ mode: 'multi', scene, initial: [asNodeId('leaf')] });
  return (
    <>
      <TrialSceneCanvas
        features={['pick', 'move', 'paths']}
        scene={scene}
        selection={selection}
        trial={ctx.trial}
        defaultPathEdit={OPENING}
      />
      <FloatingPanel anchor="top-right">
        <AnchorFields
          accepts={UNITS}
          unit="pt"
          handleCoords={ctx.config.handles}
          onHandleCoordsChange={(next) => ctx.setConfig('handles', next)}
          emptyState={<em>Select anchors to see their numbers</em>}
        />
      </FloatingPanel>
    </>
  );
}

const fieldsInstrument = defineInstrument<State, Config>({
  name: 'Anchor fields',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' }] },
  render: (ctx) => <FieldsTrial ctx={ctx} />,
});

export function AnchorFieldsLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Anchor numbers" instruments={[fieldsInstrument]} defaultInstrument="Anchor fields" />
    </div>
  );
}
