import type { ReactElement } from 'react';
import { PrefsDialog } from '@weasel-js/ui/components/Prefs';
import { usePrefsValues } from '@weasel-js/prefs/react';
import { CHART_PREFS, chartPrefs, type ChartPrefPath } from './prefs';

export function PreferencesDialog({ open, onClose }: { open: boolean; onClose: () => void }): ReactElement {
  const { values, set, unset, reset } = usePrefsValues(chartPrefs());
  return (
    <PrefsDialog
      isOpen={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      layout="rail"
      schema={CHART_PREFS}
      values={values}
      onChange={set}
      auto={unset}
      onAutoChange={(path, next) => (next ? reset(path) : set(path, chartPrefs().get(path as ChartPrefPath)))}
    />
  );
}
