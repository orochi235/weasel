import { useEffect, useRef, type SyntheticEvent } from 'react';
import { editEnd, imeKey, type EditEnd } from '@weasel-js/headless';
import s from './PageTabs.module.css';

/** Keep an event from the tab around the field: the tab would read the keys and presses as its own. */
const contain = (e: SyntheticEvent) => e.stopPropagation();

/** A tab's name, edited in place. `onDone` hears the new name, or `null` when the edit was abandoned. */
export function RenameField({ initial, onDone }: { initial: string; onDone(name: string | null): void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const finish = (how: EditEnd | null, value: string) => {
    if (!how || done.current) return;
    done.current = true;
    onDone(how === 'commit' ? value.trim() : null);
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
        if (!imeKey(e.nativeEvent)) finish(editEnd({ key: e.key, shift: e.shiftKey }), e.currentTarget.value);
      }}
      onFocus={contain}
      onBlur={(e) => { e.stopPropagation(); finish(editEnd('blur'), e.currentTarget.value); }}
    />
  );
}
