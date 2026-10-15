import { type ActionTunings, useLatest } from '@weasel-js/core';
import { type ConfigOf, defineInstrument, f, Lab, type RenderContext, TrialSceneCanvas } from '@weasel-js/labkit';
import { SelectIcon } from '@weasel-js/ui';
import { useMemo } from 'react';
import { BLOB, type PathLabState, usePathEditTrial } from './pathEditLabScene';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';

const config = f.schema({
  lock: f.enum<'none' | 'angle' | 'length'>('length', [
    { value: 'none', label: 'Modifiers only' },
    { value: 'angle', label: 'Angle (Shift)' },
    { value: 'length', label: 'Length (Mod)' },
  ]).label('Hold handle'),
});
type Config = ConfigOf<typeof config>;

function HandleLockTrial({ ctx }: { ctx: RenderContext<PathLabState, Config> }) {
  const { scene, selection, pathEdit } = usePathEditTrial(ctx, BLOB, '#a48bd4');
  const live = useLatest(ctx.config);
  const tune = useMemo<ActionTunings>(() => ({
    editAnchors: {
      params: () => {
        const { lock } = live.current;
        return { handleLock: lock === 'none' ? null : lock };
      },
    },
  }), [live]);

  return (
    <TrialSceneCanvas
      features={['pick', 'move', 'paths']}
      scene={scene}
      selection={selection}
      pathEdit={pathEdit}
      trial={ctx.trial}
      tune={tune}
    />
  );
}

const lockInstrument = defineInstrument<PathLabState, Config>({
  name: 'Handle locks',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: SelectIcon, shortcut: 'V' }] },
  render: (ctx) => <HandleLockTrial ctx={ctx} />,
});

export function HandleLockLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Handle locks" instruments={[lockInstrument]} defaultInstrument="Handle locks" />
    </div>
  );
}
