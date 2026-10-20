import { useCommand } from '@weasel-js/core';
import { ContextMenuHost } from '@weasel-js/ui/components/ContextMenu';
import { MenuBar } from '@weasel-js/ui/components/MenuBar';
import { useMemo, useState, type ReactElement } from 'react';
import './app.css';
import { CHART_ACTIONS, CHART_MENUS } from './chartCommands';
import { ChartWorkspace } from './ChartWorkspace';
import { chartMenuBar } from './menuBar';
import { MODE_MENU, useModeCommands, type ChartMode } from './modes';
import { PreferencesDialog } from './PreferencesDialog';
import { PIPELINE_MENUS } from './pipeline/pipelineCommands';
import { PipelineWorkspace } from './pipeline/PipelineWorkspace';
import { usePipelineDoc } from './pipeline/usePipelineDoc';
import { useChartPref } from './prefs';

export type { ChartMode } from './modes';

export function App(): ReactElement {
  const [mode, setMode] = useState<ChartMode>('chart');
  const pipeline = usePipelineDoc();
  // A view choice, not part of the pipeline doc.
  const [look, setLook] = useChartPref('pipeline.look');
  const [prefsOpen, setPrefsOpen] = useState(false);
  useModeCommands(mode, setMode);
  useCommand(CHART_ACTIONS.preferences, 'Preferences…', () => setPrefsOpen(true));
  const menuBar = useMemo(
    () => chartMenuBar({ ...(mode === 'chart' ? CHART_MENUS : PIPELINE_MENUS), mode: MODE_MENU }),
    [mode],
  );

  return (
    <div className="wc-app" data-mode={mode}>
      <MenuBar schema={menuBar} className="wc-menubar" />
      {mode === 'chart' ? <ChartWorkspace /> : <PipelineWorkspace pipeline={pipeline} look={look} setLook={setLook} />}
      <PreferencesDialog open={prefsOpen} onClose={() => setPrefsOpen(false)} />
      <ContextMenuHost />
    </div>
  );
}

export default App;
