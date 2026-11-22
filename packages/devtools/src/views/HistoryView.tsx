/**
 * The History tab: each step the scene's history took, newest first, read
 * through its cursor whenever a notice reports one; where the history stands;
 * and, on request, every entry on its stacks.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { DevtoolsHistoryRecord, DevtoolsHistorySlice } from '../protocol';
import { Badge } from '@weasel-js/ui/components/Badge';
import { Button } from '@weasel-js/ui/components/Button';
import { Switch } from '@weasel-js/ui/components/Switch';
import { usePoll } from '../hooks';
import type { DevtoolsViewProps } from '../tabs';
import { followHistory } from '../history';
import { coalesced } from './coalesced';
import { entryName, HistoryTable } from './HistoryTable';
import { sequenced, type Sequenced } from './sequenced';
import s from './HistoryView.module.css';

/** As many steps as a canvas's own buffer holds. */
const KEEP = 200;
/** How often the Age column moves on between reads, as often as the Dispatch tab's does. */
const AGE_MS = 250;

export function HistoryView({ client, rootId }: DevtoolsViewProps): ReactElement {
  const follower = useMemo(() => followHistory(client, rootId), [client, rootId]);
  const [steps, setSteps] = useState<Sequenced<DevtoolsHistoryRecord>[]>([]);
  const [position, setPosition] = useState<DevtoolsHistorySlice['position'] | null>(null);
  const [historyEntries, setHistoryEntries] = useState<DevtoolsHistorySlice['historyEntries'] | null>(null);
  const [showStack, setShowStack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Each read advances the follower's cursor, so the subscription outlives a switch flip: one torn down mid-read
  // would drop what that read brought back.
  const readNow = useRef<() => void>(() => {});

  useEffect(() => {
    let live = true;
    const once = (): Promise<void> => (!live ? Promise.resolve() : follower.read().then((slice) => {
      if (!live) return;
      if (slice.entries.length) setSteps((prev) => [...prev, ...sequenced(slice.entries, slice.cursor)].slice(-KEEP));
      setPosition(slice.position);
      setHistoryEntries(slice.historyEntries ?? null);
      setNow(Date.now());
      setError(null);
    }, (err: Error) => { if (live) setError(err.message); }));
    const read = coalesced(once);
    readNow.current = read;
    read();
    const off = client.onChanged((id, areas) => { if (id === rootId && areas.includes('history')) read(); });
    return () => { live = false; off(); };
  }, [client, rootId, follower]);

  // A read that failed has no notice coming to retry it, so the Age poll does.
  usePoll(() => { setNow(Date.now()); if (error) readNow.current(); }, AGE_MS, true);

  const toggleStack = (on: boolean): void => {
    follower.setHistoryEntries(on);
    setShowStack(on);
    readNow.current();
  };

  return (
    <div className={s.history}>
      <div className={s.toolbar}>
        <Badge size="sm" variant="subtle" emphasis={position?.canUndo ? 'high' : 'low'}>
          {position?.canUndo ? 'can undo' : 'nothing to undo'}
        </Badge>
        <Badge size="sm" variant="subtle" emphasis={position?.canRedo ? 'high' : 'low'}>
          {position?.canRedo ? 'can redo' : 'nothing to redo'}
        </Badge>
        <Switch isSelected={showStack} onChange={toggleStack}>entries</Switch>
        <Button size="sm" variant="ghost" disabled={steps.length === 0} onClick={() => setSteps([])}>Clear</Button>
        <span className={s.position} role="status" aria-label="Position" title="entries applied / entries in all">
          {position ? `${position.index} / ${position.total}` : ''}
        </span>
      </div>
      {error && <p className={s.note} role="alert">{error}</p>}
      <div className={s.body}>
        {showStack && historyEntries && (
          <section aria-label="Checkpoint stack">
            <h3 className={s.heading}>History entries</h3>
            {historyEntries.length === 0 ? <p className={s.note}>The stacks are empty.</p> : (
              <ol className={s.stack} aria-label="History entries">
                {historyEntries.map((c, i) => (
                  <li key={c.id} className={position && i < position.index ? s.applied : s.redoable}>
                    {entryName(c)}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
        <HistoryTable steps={steps} now={now} />
      </div>
    </div>
  );
}
