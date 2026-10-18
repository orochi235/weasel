import { useSyncExternalStore } from 'react';
import type { MenuColorEntry, MenuController, MenuNumberEntry } from '@weasel-js/menu';
import { UnitField } from '../NumberField/UnitField';
import { Swatch } from '../Properties/PropertyReadout';
import s from './ContextMenu.module.css';

/** The id of the field inside number row `rowId`, which the panel focuses on Enter. */
export const menuFieldId = (rowId: string) => `${rowId}-field`;

/** A number row's field and unit, edited in place: what it shows is the controller's, so it holds what was set
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
        step={e.step}
        {...(e.display ? { display: e.display } : {})}
        disabled={e.disabled}
        ghost
        width="fit"
      />
      {e.suffix !== undefined && <span className={s.unit}>{e.suffix}</span>}
    </span>
  );
}

/** A color row's swatch and hex, or a dash for none. */
export function MenuColorValue({ entry: e }: { entry: MenuColorEntry }) {
  if (e.value === undefined) return <span className={`${s.value} ${s.unit}`}>—</span>;
  return <span className={s.value}><Swatch color={e.value} />{e.value}</span>;
}
