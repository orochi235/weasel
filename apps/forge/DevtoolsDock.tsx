import { useMemo } from 'react';
import { DevtoolsPanel, createInPagePanelTransport } from '@weasel-js/devtools';
import s from './devtools.module.css';

/** The devtools panel over the canvases on the page, which in the workshop are the story's. */
export default function DevtoolsDock() {
  const transport = useMemo(() => createInPagePanelTransport(), []);
  return (
    <div className={s.panel}>
      <DevtoolsPanel transport={transport} />
    </div>
  );
}
