import { coreKitSettingsSchema, SceneCanvas, useScene, type Fill } from '@weasel-js/core';
import { guidesKitSettingsSchema } from '@weasel-js/guides';
import { kitSettingsCssOptions, mergePrefGroups, prefsCss } from '@weasel-js/prefs';
import { KitSettingsFromPrefs, usePrefsStore, usePrefsValues } from '@weasel-js/prefs/react';
import { localStorageAdapter } from '@weasel-js/storage';
import { Button, PrefsForm, Tree, type TreeNode, UnitField, uiKitSettingsSchema } from '@weasel-js/ui';
import { useState } from 'react';
import s from './KitSettingsDemo.module.css';

const SCHEMA = mergePrefGroups('Kit settings', uiKitSettingsSchema, coreKitSettingsSchema, guidesKitSettingsSchema);

const FILES: readonly TreeNode[] = [
  { id: 'src', label: 'src', children: [{ id: 'app', label: 'app.ts' }, { id: 'apex', label: 'apex.ts' }, { id: 'atlas', label: 'atlas.ts' }] },
  { id: 'docs', label: 'docs', children: [{ id: 'readme', label: 'README.md' }] },
  { id: 'package', label: 'package.json' },
];

const RECTS: { id: string; x: number; y: number; width: number; height: number; fill: Fill }[] = [
  { id: 'a', x: 30, y: 30, width: 90, height: 60, fill: { paint: { color: '#7fb069' } } },
  { id: 'b', x: 160, y: 60, width: 70, height: 70, fill: { paint: { color: '#a48bd4' } } },
];

function Specimens() {
  const scene = useScene({ items: RECTS });
  const [n, setN] = useState(10);
  return (
    <div className={s.specimens}>
      <Tree aria-label="Files" nodes={FILES} defaultExpandedIds={['src']} />
      <UnitField aria-label="Count" value={n} onChange={setN} steppers />
      <SceneCanvas features={['pick', 'move', 'transform']} width={260} height={160} className="ckd-canvas" scene={scene} />
    </div>
  );
}

export function KitSettingsDemo() {
  const store = usePrefsStore(SCHEMA, { storage: localStorageAdapter, prefix: 'weasel-demo-kit-settings.' });
  const { values, set, reset } = usePrefsValues(store);
  return (
    <KitSettingsFromPrefs store={store} css>
      <div className={s.demo}>
        <div className={s.form}>
          <PrefsForm layout="list" schema={SCHEMA} values={values} onChange={set} />
          <Button onClick={() => reset()}>Reset</Button>
        </div>
        <div className={s.side}>
          <Specimens />
          <pre className={s.css}>{prefsCss(store, kitSettingsCssOptions())}</pre>
        </div>
      </div>
    </KitSettingsFromPrefs>
  );
}
