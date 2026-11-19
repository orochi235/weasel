import { useRef } from 'react';
import { useElapsed } from '@weasel-js/react';
import s from './ReactDemo.module.css';

/** A box counting the seconds it has been seen: `useElapsed` stands still while it is out of view. */
function Seen({ label }: { label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const ms = useElapsed({ target: box });
  return (
    <div ref={box} className={s.box} role="group" aria-label={label}>
      <span>{label}</span>
      <span className={s.seconds}>{(ms / 1000).toFixed(2)} s</span>
    </div>
  );
}

export function ReactDemo() {
  const page = useElapsed();
  return (
    <div className={s.demo}>
      <p className={s.page}>
        page, with no target <span className={s.seconds}>{(page / 1000).toFixed(2)} s</span>
      </p>
      <div className={s.pane} tabIndex={0} aria-label="Scroll pane">
        <Seen label="top" />
        <div className={s.gap} />
        <Seen label="bottom" />
      </div>
    </div>
  );
}
