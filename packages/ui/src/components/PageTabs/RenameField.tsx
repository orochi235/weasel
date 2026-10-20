import { useEffect, useRef, type SyntheticEvent } from 'react';
import s from './PageTabs.module.css';

/** Keep an event from the tab around the field: the tab would read the keys and presses as its own. */
const contain = (e: SyntheticEvent) => e.stopPropagation();

/** A tab's name, edited in place. `onDone` hears the new name, or `null` when the edit was abandoned. */
export function RenameField({ initial, onDone }: { initial: string; onDone(name: string | null): void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const finish = (name: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(name);
  };
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      className={s.rename}
      aria-label="Page name"
      defaultValue={initial}
      onPointerDown={contain}
      onMouseDown={contain}
      onClick={contain}
      onKeyUp={contain}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(e.currentTarget.value.trim());
        else if (e.key === 'Escape') finish(null);
      }}
      onFocus={contain}
      onBlur={(e) => { e.stopPropagation(); finish(e.currentTarget.value.trim()); }}
    />
  );
}
