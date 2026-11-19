import { defineInstrument, Lab, type RenderContext, TrialSceneCanvas } from '@weasel-js/labkit';
import { pref } from '@weasel-js/prefs';
import { PrefsBar } from '@weasel-js/ui/components/PrefsBar';
import s from './HandleLockLabDemo.module.css';
import { BLOB, type PathLabState, usePathEditTrial } from './pathEditLabScene';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';
import * as pathTools from '@weasel-js/path-tools/presets';
import * as presets from '@weasel-js/editing/presets';

const FEATURES = [presets.pick, presets.move, pathTools.paths, pathTools.handleLocks] as const;

/** The two handle-lock toggles, drawn from the actions registry. */
const LOCK_BAR = pref.group('', {
  angle: pref.action('handleLock.angle'),
  length: pref.action('handleLock.length'),
});

function HandleLockTrial({ ctx }: { ctx: RenderContext<PathLabState, Record<string, never>> }) {
  const { scene, selection, pathEdit } = usePathEditTrial(ctx, BLOB, { color: '#a48bd4' });
  return (
    <div className={s.trial}>
      <TrialSceneCanvas
        features={FEATURES}
        scene={scene}
        selection={selection}
        pathEdit={pathEdit}
        trial={ctx.trial}
      />
      <PrefsBar schema={LOCK_BAR} label="Handle locks" className={s.locks} />
    </div>
  );
}

const lockInstrument = defineInstrument<PathLabState, Record<string, never>>({
  name: 'Handle locks',
  initialState: () => ({ scene: null }),
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('editing:select') }] },
  render: (ctx) => <HandleLockTrial ctx={ctx} />,
});

export function HandleLockLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Handle locks" instruments={[lockInstrument]} />
    </div>
  );
}
