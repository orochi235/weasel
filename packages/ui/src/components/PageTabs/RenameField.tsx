import { useEffect, useRef, type SyntheticEvent } from 'react';
import { editEnd, imeKey, type EditEnd } from '@weasel-js/ui-input';
import s from './PageTabs.module.css';

/** Keep an event from the tab around the field: the tab would read the keys and presses as its own. */
const contain = (e: SyntheticEvent) => e.stopPropagation();

/** A tab's name, edited in place. `onDone` hears the new name, or `null` when the edit was abandoned or left the text
 *  as it was: an unnamed page's field holds its numbered label, which must not become its name. */
export function RenameField({ initial, onDone }: { initial: string; onDone(name: string | null): void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const finish = (how: EditEnd | null, value: string, from?: HTMLElement) => {
    if (!how || done.current) return;
    done.current = true;
    const name = value.trim();
    // A key ends the edit with focus in the field, which goes with it.
    from?.closest<HTMLElement>('[role="tab"]')?.focus();
    onDone(how === 'commit' && name !== initial ? name : null);
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
        if (!imeKey(e.nativeEvent)) finish(editEnd({ key: e.key, shift: e.shiftKey }), e.currentTarget.value, e.currentTarget);
      }}
      onFocus={contain}
      onBlur={(e) => { e.stopPropagation(); finish(editEnd('blur'), e.currentTarget.value); }}
    />
  );
}
