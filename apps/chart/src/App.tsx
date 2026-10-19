import { MenuBar } from '@weasel-js/ui/components/MenuBar';
import { useMemo, useState, type ReactElement } from 'react';
import './app.css';
import { CHART_MENUS } from './chartCommands';
import { ChartWorkspace } from './ChartWorkspace';
import { chartMenuBar } from './menuBar';

export type ChartMode = 'chart' | 'pipeline';

export function App(): ReactElement {
  const [mode] = useState<ChartMode>('chart');
  const menuBar = useMemo(() => chartMenuBar(mode === 'chart' ? CHART_MENUS : {}), [mode]);

  return (
    <div className="wc-app" data-mode={mode}>
      <MenuBar schema={menuBar} className="wc-menubar" />
      {mode === 'chart' && <ChartWorkspace />}
    </div>
  );
}

export default App;
