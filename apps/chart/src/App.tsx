import { MenuBar } from '@weasel-js/ui/components/MenuBar';
import { useMemo, useState, type ReactElement } from 'react';
import './app.css';
import { CHART_MENUS } from './chartCommands';
import { ChartWorkspace } from './ChartWorkspace';
import { chartMenuBar } from './menuBar';
import { MODE_MENU, useModeCommands, type ChartMode } from './modes';
import { PIPELINE_MENUS } from './pipeline/pipelineCommands';
import { PipelineWorkspace } from './pipeline/PipelineWorkspace';

export type { ChartMode } from './modes';

export function App(): ReactElement {
  const [mode, setMode] = useState<ChartMode>('chart');
  useModeCommands(mode, setMode);
  const menuBar = useMemo(
    () => chartMenuBar({ ...(mode === 'chart' ? CHART_MENUS : PIPELINE_MENUS), mode: MODE_MENU }),
    [mode],
  );

  return (
    <div className="wc-app" data-mode={mode}>
      <MenuBar schema={menuBar} className="wc-menubar" />
      {mode === 'chart' ? <ChartWorkspace /> : <PipelineWorkspace />}
    </div>
  );
}

export default App;
