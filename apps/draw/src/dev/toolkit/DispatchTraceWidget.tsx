import { PropertyPanel, Switch } from '@weasel-js/ui';
import { type ReactElement, useState } from 'react';
import { useDispatchTraceLog } from '../dispatchTraceLog';
import { DispatchTraceTable } from '../DispatchTraceTable';
import s from '../ToolkitBuilder.module.css';

// Unhandled events (idle mousemoves, wheels over chrome) are noisy and hidden by default.

export function DispatchTraceWidget(): ReactElement {
  const { entries, live, now } = useDispatchTraceLog();
  const [showUnhandled, setShowUnhandled] = useState<boolean>(false);

  return (
    <PropertyPanel
      stance="debug"
      className={s.widget}
      title={`Dispatch · ${entries.length}`}
      actions={(
        <Switch isSelected={showUnhandled} onChange={setShowUnhandled}>
          unhandled
        </Switch>
      )}
    >
      <div className={s.widgetBodyScrollY}>
        <DispatchTraceTable
          entries={entries}
          live={live}
          now={now}
          showUnhandled={showUnhandled}
          empty={entries.length > 0
            ? 'All recorded events hidden — toggle “unhandled” to show them.'
            : 'No dispatch events yet. Interact with the canvas to populate the trace.'}
        />
      </div>
    </PropertyPanel>
  );
}
