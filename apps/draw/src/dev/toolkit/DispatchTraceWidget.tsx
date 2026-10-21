import { DevtoolsPanel, createInPagePanelTransport } from '@weasel-js/devtools';
import { PropertyPanel } from '@weasel-js/ui/components/Properties';
import { type ReactElement, useMemo } from 'react';
import s from '../ToolkitBuilder.module.css';

/** The canvas's dispatch trace, through the devtools panel's Dispatch view. */
export function DispatchTraceWidget(): ReactElement {
  const transport = useMemo(() => createInPagePanelTransport(), []);
  return (
    <PropertyPanel stance="debug" className={s.widget} title="Dispatch">
      <div className={s.widgetDevtools}>
        <DevtoolsPanel transport={transport} tabs={['dispatch']} />
      </div>
    </PropertyPanel>
  );
}
