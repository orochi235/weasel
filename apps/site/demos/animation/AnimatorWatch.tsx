import { useEffect, useState } from 'react';
import type { AnimationInfo, Animator, LiveAnimation } from '@weasel-js/animator';
import styles from '../AnimationDemo.module.css';

const nameOf = (a: AnimationInfo): string => `#${a.id} ${a.kind} ${a.label ?? a.key ?? ''}`;

/** What the animator is running, from `live()`, and its last few lifecycle
 *  events, from `watch()`. Refreshed on the animator's own frames. */
export function AnimatorWatch({ animator }: { animator: Animator }) {
  const [rows, setRows] = useState<LiveAnimation[]>([]);
  const [log, setLog] = useState<string[]>([]);
  useEffect(() => {
    const refresh = () => setRows(animator.live());
    const stopTick = animator.onTick(refresh);
    const stopWatch = animator.watch((e) => {
      if (e.type === 'fire' || e.type === 'lap') return;
      setLog((l) => [`${e.type.padEnd(9)} ${nameOf(e.animation)}`, ...l].slice(0, 8));
      refresh();
    });
    refresh();
    return () => { stopTick(); stopWatch(); };
  }, [animator]);
  return (
    <div className={styles.watch}>
      <div>
        <h4>live ({rows.length})</h4>
        <table>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{nameOf(a)}</td>
                <td className={styles.num}>{a.progress == null ? '' : `${(a.progress * 100).toFixed(0)}%`}</td>
                <td>{a.paused ? 'paused' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h4>events</h4>
        <ul className={styles.log}>{log.map((line, i) => <li key={i}>{line}</li>)}</ul>
      </div>
    </div>
  );
}

