import { EditorShell } from '@weasel-js/editor';
import { useMemo, useState, type ReactElement } from 'react';
import './app.css';
import { CHART_MENUS } from './chartCommands';
import { ChartWorkspace } from './ChartWorkspace';
import { CHART_MENU_TITLES } from './menuBar';
import { MODE_MENU, useModeCommands, type ChartMode } from './modes';
import { PIPELINE_MENUS } from './pipeline/pipelineCommands';
import { PipelineWorkspace } from './pipeline/PipelineWorkspace';
import { usePipelineDoc } from './pipeline/usePipelineDoc';
import { chartPrefs, useChartPref } from './prefs';

export type { ChartMode } from './modes';

export function App(): ReactElement {
  const [mode, setMode] = useState<ChartMode>('chart');
  const menus = useMemo(() => ({ ...(mode === 'chart' ? CHART_MENUS : PIPELINE_MENUS), mode: MODE_MENU }), [mode]);

  return (
    <div className="wc-app" data-mode={mode}>
      <EditorShell prefs={chartPrefs()} menus={menus} menuTitles={CHART_MENU_TITLES} menuBarClassName="wc-menubar">
        <Modes mode={mode} setMode={setMode} />
      </EditorShell>
    </div>
  );
}

/** The workspace of the mode that is on, and the commands that switch modes. */
function Modes({ mode, setMode }: { mode: ChartMode; setMode: (mode: ChartMode) => void }): ReactElement {
  const pipeline = usePipelineDoc();
  // A view choice, not part of the pipeline doc.
  const [look, setLook] = useChartPref('pipeline.look');
  useModeCommands(mode, setMode);
  return mode === 'chart' ? <ChartWorkspace /> : <PipelineWorkspace pipeline={pipeline} look={look} setLook={setLook} />;
}

export default App;
