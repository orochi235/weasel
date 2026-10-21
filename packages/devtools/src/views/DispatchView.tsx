/**
 * The Dispatch tab: the root's trace of resolved inputs and mode switches,
 * what a press at the pointer would do now, and, behind a toggle, the
 * `clientToWorld` conversions. Read through cursors, so each read carries only
 * what is new; polled while open, because the live prediction moves with the
 * pointer and no notice reports that.
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { DispatchRecord, TraceLogEntry } from '@weasel-js/core/routing';
import { Button } from '@weasel-js/ui/components/Button';
import { Switch } from '@weasel-js/ui/components/Switch';
import { ToggleBar } from '@weasel-js/ui/components/ToggleBar';
import { usePoll } from '../hooks';
import type { DevtoolsViewProps } from '../tabs';
import { followTrace } from '../trace';
import { CoordTable, type CoordEntry } from './CoordTable';
import { TraceTable } from './TraceTable';
import s from './DispatchView.module.css';

type Outcome = 'handled' | 'unhandled';

const POLL_MS = 250;
/** How many records the panel keeps, as many as a canvas's own buffer holds. */
const KEEP = 200;

export function DispatchView({ client, rootId }: DevtoolsViewProps): ReactElement {
  const follower = useMemo(() => followTrace(client, rootId), [client, rootId]);
  const [entries, setEntries] = useState<TraceLogEntry[]>([]);
  const [coords, setCoords] = useState<CoordEntry[]>([]);
  const [live, setLive] = useState<DispatchRecord | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Unhandled inputs are every idle pointer move and every wheel over chrome, so they start hidden.
  const [shown, setShown] = useState<readonly Outcome[]>(['handled']);
  const [showCoords, setShowCoords] = useState(false);

  const read = (): void => {
    follower.read().then((slice) => {
      if (slice.entries.length) setEntries((prev) => [...prev, ...(slice.entries as unknown as TraceLogEntry[])].slice(-KEEP));
      if (slice.coords?.length) setCoords((prev) => [...prev, ...(slice.coords as unknown as CoordEntry[])].slice(-KEEP));
      setLive(slice.live as unknown as DispatchRecord | null);
      setNow(Date.now());
    }, () => {});
  };

  useEffect(() => client.onChanged((id, areas) => {
    if (id === rootId && areas.includes('trace')) read();
  }));
  usePoll(read, POLL_MS, true);

  const toggleCoords = (on: boolean): void => {
    follower.setCoords(on);
    setShowCoords(on);
    if (!on) setCoords([]);
  };

  return (
    <div className={s.dispatch}>
      <div className={s.toolbar}>
        <ToggleBar<Outcome>
          mode="multiple"
          variant="minimal"
          size="sm"
          ariaLabel="Outcome filters"
          items={[
            { value: 'handled', label: 'handled', tooltip: 'Show handled inputs and mode switches' },
            { value: 'unhandled', label: 'unhandled', tooltip: 'Show inputs nothing handled' },
          ]}
          value={shown}
          onChange={(next) => setShown(next)}
        />
        <Switch isSelected={showCoords} onChange={toggleCoords}>coords</Switch>
        <Button size="sm" variant="ghost" disabled={entries.length === 0} onClick={() => setEntries([])}>
          Clear
        </Button>
        <span className={s.count}>{entries.length} {entries.length === 1 ? 'record' : 'records'}</span>
      </div>
      <div className={s.body}>
        <TraceTable
          entries={entries}
          live={live}
          now={now}
          showHandled={shown.includes('handled')}
          showUnhandled={shown.includes('unhandled')}
          empty={entries.length > 0
            ? 'Every record is hidden by the filters above.'
            : 'No input yet. Use the canvas to fill the trace.'}
        />
        {showCoords && <CoordTable entries={coords} now={now} />}
      </div>
    </div>
  );
}
