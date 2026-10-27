import { useRef, useState, useSyncExternalStore } from 'react';
import {
  menuNumberDisplay, type MenuController, type MenuNumberEntry, type MenuTextEntry,
} from '@weasel-js/menu';
import { Input } from '../Input';
import { UnitField } from '../NumberField/UnitField';
import s from './ContextMenu.module.css';

/** The id of the field inside number or text row `rowId`, which the panel focuses on Enter. */
export const menuFieldId = (rowId: string) => `${rowId}-field`;

/** A number row's field and unit, which an infinity goes without, edited in place: what it shows is the controller's, so it holds what was set
 *  while the menu stays open. */
export function MenuNumberValue({ entry: e, rowId, controller: c }: {
  entry: MenuNumberEntry; rowId: string; controller: MenuController;
}) {
  const value = useSyncExternalStore(c.subscribe, () => c.numberValue(e), () => c.numberValue(e));
  return (
    <span className={s.value}>
      <UnitField
        id={menuFieldId(rowId)}
        aria-label={e.label}
        value={value ?? Number.NaN}
        onChange={(v) => c.setNumber(e, v)}
        minValue={e.min}
        maxValue={e.max}
        endless={e.endless}
        step={e.step}
        accepts={e.accepts}
        display={menuNumberDisplay(e)}
        disabled={e.disabled}
        ghost
        width="fit"
      />
      {e.suffix !== undefined && (value === undefined || Number.isFinite(value)) && <span className={s.unit}>{e.suffix}</span>}
    </span>
  );
}

/** A text row's field, edited in place: what is typed is written on Enter or blur, and Escape puts back what the
 *  controller holds. The panel takes focus back on either key. */
export function MenuTextValue({ entry: e, rowId, controller: c }: {
  entry: MenuTextEntry; rowId: string; controller: MenuController;
}) {
  const held = useSyncExternalStore(c.subscribe, () => c.textValue(e), () => c.textValue(e)) ?? '';
  const [draft, setDraftState] = useState<string | null>(null);
  // Escape and Enter hand focus to the panel inside the same keydown, and the blur that follows must see the edit
  // they just made, not this render's.
  const latest = useRef<string | null>(null);
  const setDraft = (next: string | null) => { latest.current = next; setDraftState(next); };
  const commit = () => {
    if (latest.current !== null) c.setText(e, latest.current);
    setDraft(null);
  };
  return (
    <span className={s.value}>
      <Input
        id={menuFieldId(rowId)}
        aria-label={e.label}
        className={s.text}
        value={draft ?? held}
        onChange={setDraft}
        onBlur={commit}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') commit();
          else if (ev.key === 'Escape') setDraft(null);
          ev.continuePropagation();
        }}
        isDisabled={e.disabled}
      />
    </span>
  );
}
