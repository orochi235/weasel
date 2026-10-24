/**
 * The History tab: each step the scene's history took, newest first, read
 * through its cursor whenever a notice reports one; where the history stands;
 * and, on request, every entry on its stacks.
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { DevtoolsHistoryRecord, DevtoolsHistorySlice } from '@weasel-js/core/devtools-protocol';
import { Badge } from '@weasel-js/ui/components/Badge';
import { Button } from '@weasel-js/ui/components/Button';
import { Switch } from '@weasel-js/ui/components/Switch';
import type { DevtoolsViewProps } from '../tabs';
import { followHistory } from '../history';
import { HistoryTable } from './HistoryTable';
import s from './HistoryView.module.css';

/** As many steps as a canvas's own buffer holds. */
const KEEP = 200;

export function HistoryView({ client, rootId }: DevtoolsViewProps): ReactElement {
  const follower = useMemo(() => followHistory(client, rootId), [client, rootId]);
  const [steps, setSteps] = useState<DevtoolsHistoryRecord[]>([]);
  const [position, setPosition] = useState<DevtoolsHistorySlice['position'] | null>(null);
  const [checkpoints, setCheckpoints] = useState<DevtoolsHistorySlice['checkpoints'] | null>(null);
  const [showStack, setShowStack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    const read = (): void => {
      follower.read().then((slice) => {
        if (!live) return;
        if (slice.entries.length) setSteps((prev) => [...prev, ...slice.entries].slice(-KEEP));
        setPosition(slice.position);
        setCheckpoints(slice.checkpoints ?? null);
        setNow(Date.now());
        setError(null);
      }, (err: Error) => { if (live) setError(err.message); });
    };
    read();
    const off = client.onChanged((id, areas) => { if (id === rootId && areas.includes('history')) read(); });
    return () => { live = false; off(); };
  }, [client, rootId, follower, showStack]);

  const toggleStack = (on: boolean): void => {
    follower.setCheckpoints(on);
    setShowStack(on);
  };

  if (error) return <p className={s.note}>{error}</p>;

  return (
    <div className={s.history}>
      <div className={s.toolbar}>
        <Badge size="sm" variant="subtle" emphasis={position?.canUndo ? 'high' : 'low'}>
          {position?.canUndo ? 'can undo' : 'nothing to undo'}
        </Badge>
        <Badge size="sm" variant="subtle" emphasis={position?.canRedo ? 'high' : 'low'}>
          {position?.canRedo ? 'can redo' : 'nothing to redo'}
        </Badge>
        <Switch isSelected={showStack} onChange={toggleStack}>checkpoints</Switch>
        <Button size="sm" variant="ghost" disabled={steps.length === 0} onClick={() => setSteps([])}>Clear</Button>
        <span className={s.position} role="status" aria-label="Position" title="entries applied / entries in all">
          {position ? `${position.index} / ${position.total}` : ''}
        </span>
      </div>
      <div className={s.body}>
        {showStack && checkpoints && (
          <section aria-label="Checkpoint stack">
            <h3 className={s.heading}>Checkpoints</h3>
            {checkpoints.length === 0 ? <p className={s.note}>The stacks are empty.</p> : (
              <ol className={s.stack} aria-label="Checkpoints">
                {checkpoints.map((c, i) => (
                  <li key={c.id} className={position && i < position.index ? s.applied : s.redoable}>
                    {c.label || c.id}
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
