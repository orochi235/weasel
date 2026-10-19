import { useEffect, useRef, type ReactNode } from 'react';
import s from './DemoDevtools.module.css';

/**
 * The demo, and while `panel` is given, the panel beside it: the demo's column
 * narrows to make room, scrolling sideways if it must, and the panel stays in
 * view as the page scrolls. The demo's own element never moves in the tree, so
 * opening the panel does not remount it.
 */
export function DevtoolsSplit({ panel, children }: { panel: ReactNode; children: ReactNode }) {
  const side = useRef<HTMLDivElement>(null);
  const open = panel != null;
  // The panel opens below the demo's header, which can leave its foot under the fold.
  useEffect(() => {
    if (open) side.current?.scrollIntoView({ block: 'nearest' });
  }, [open]);
  return (
    <div className={open ? `${s.stage} ${s.split}` : s.stage}>
      <div className={s.demo}>{children}</div>
      {open ? <div ref={side} className={s.side}>{panel}</div> : null}
    </div>
  );
}
