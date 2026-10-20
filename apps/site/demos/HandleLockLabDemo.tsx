import { defineInstrument, Lab, type RenderContext, TrialSceneCanvas } from '@weasel-js/labkit';
import { handleLocksPreset } from '@weasel-js/path-tools';
import type { PrefGroup } from '@weasel-js/prefs';
import { Bar } from '@weasel-js/ui/components/Bar';
import s from './HandleLockLabDemo.module.css';
import { BLOB, type PathLabState, usePathEditTrial } from './pathEditLabScene';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const FEATURES = ['pick', 'move', 'paths', handleLocksPreset] as const;

/** The two handle-lock toggles, drawn from the actions registry. */
const LOCK_BAR: PrefGroup = {
  name: '',
  children: Object.fromEntries(['handleLock.angle', 'handleLock.length'].map((action, i) => [
    `lock${i}`,
    { kind: 'action', name: '', description: '', default: undefined, action },
  ])),
};

function HandleLockTrial({ ctx }: { ctx: RenderContext<PathLabState, Record<string, never>> }) {
  const { scene, selection, pathEdit } = usePathEditTrial(ctx, BLOB, '#a48bd4');
  return (
    <div className={s.trial}>
      <TrialSceneCanvas
        features={FEATURES}
        scene={scene}
        selection={selection}
        pathEdit={pathEdit}
        trial={ctx.trial}
      />
      <Bar schema={LOCK_BAR} label="Handle locks" className={s.locks} />
    </div>
  );
}

const lockInstrument = defineInstrument<PathLabState, Record<string, never>>({
  name: 'Handle locks',
  defaultConfig: () => ({}),
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' }] },
  render: (ctx) => <HandleLockTrial ctx={ctx} />,
});

export function HandleLockLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Handle locks" instruments={[lockInstrument]} defaultInstrument="Handle locks" />
    </div>
  );
}
