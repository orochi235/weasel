import { SceneCanvas, useScene, viewPreset, type Fill } from '@weasel-js/core';
import { movePreset, selectPreset } from '@weasel-js/editing';
import { pageGridSchema, usePageGrid } from '@weasel-js/editor';
import { pref } from '@weasel-js/prefs';
import { usePrefGroup, usePrefsStore, usePrefsValues } from '@weasel-js/prefs/react';
import { localStorageAdapter } from '@weasel-js/storage';
import { PrefsForm } from '@weasel-js/ui/components/Prefs';
import { useMemo } from 'react';
import s from './PageGridDemo.module.css';

const SCHEMA = pref.group('Preferences', { grid: pageGridSchema });

const PAGE = { width: 400, height: 280 };
const RECTS: { id: string; x: number; y: number; width: number; height: number; fill: Fill }[] = [
  { id: 'a', x: 40, y: 40, width: 80, height: 60, fill: { paint: { color: '#7fb069' } } },
  { id: 'b', x: 200, y: 120, width: 60, height: 60, fill: { paint: { color: '#a48bd4' } } },
];

export function PageGridDemo() {
  const store = usePrefsStore(SCHEMA, { storage: localStorageAdapter, prefix: 'weasel-demo-page-grid.' });
  const { form } = usePrefsValues(store);
  const [grid] = usePrefGroup(store, 'grid');
  const { layer, source } = usePageGrid({ ...grid, page: PAGE, background: '#ffffff' });
  const scene = useScene({ items: RECTS });
  const snap = useMemo(() => ({ sources: source ? [source] : [] }), [source]);

  return (
    <div className={s.demo}>
      <PrefsForm layout="list" {...form} />
      <SceneCanvas
        features={[selectPreset, movePreset, viewPreset]}
        width={PAGE.width}
        height={PAGE.height}
        className="ckd-canvas"
        scene={scene}
        snap={snap}
        layers={layer ? { grid: { layer } } : {}}
      />
    </div>
  );
}
