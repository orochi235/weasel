import { SceneCanvas, useCanvasSize, useScene } from '@weasel-js/core';
import { MenuBar } from '@weasel-js/ui/components/MenuBar';
import { useMemo, useRef, useState, type ReactElement } from 'react';
import './app.css';
import { chartMenuBar } from './menuBar';

export type ChartMode = 'chart' | 'pipeline';

export function App(): ReactElement {
  const [mode] = useState<ChartMode>('chart');
  const menuBar = useMemo(() => chartMenuBar(), []);
  const scene = useScene<{ id: string }>({ items: [] });
  const hostRef = useRef<HTMLDivElement>(null);
  const { width, height } = useCanvasSize(hostRef);

  return (
    <div className="wc-app" data-mode={mode}>
      <MenuBar schema={menuBar} className="wc-menubar" />
      <div className="wc-host" ref={hostRef}>
        {width > 0 && height > 0 && (
          <SceneCanvas aria-label="Chart" scene={scene} width={width} height={height} />
        )}
      </div>
    </div>
  );
}

export default App;
