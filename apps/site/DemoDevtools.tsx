/** DEV-only: the devtools panel over the demo's canvases, beside the demo. */
import { useMemo } from 'react';
import { DevtoolsPanel, createInPagePanelTransport } from '@weasel-js/devtools';
import s from './DemoDevtools.module.css';

export default function DemoDevtools() {
  const transport = useMemo(() => createInPagePanelTransport(), []);
  return (
    <div className={s.panel}>
      <DevtoolsPanel transport={transport} />
    </div>
  );
}
