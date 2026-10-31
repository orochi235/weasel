import type { ReactNode } from 'react';
import { FitLabel, labelForms } from '../FitLabel/FitLabel';
import { type DistributiveOmit, PropertyControl, type PropertyControlProps } from '../Properties/PropertyField';
import { PropertyReadout } from '../Properties/PropertyReadout';
import { BarPopover } from './BarPopover';
import { useOrientation } from '../orientation';
import s from './Bar.module.css';

/** What {@link BarField} adds to the field it draws. */
export interface BarFieldCellProps {
  /** Shorter forms of `name`, longest first, for the label a value box sits
   *  behind when the bar is short of room. */
  short?: readonly string[];
  /** A glyph set before a value box in place of its name. */
  icon?: ReactNode;
}

/** Props for {@link BarField}: one field, as `PropertyField` takes it. */
export type BarFieldProps<T extends string = string> = DistributiveOmit<PropertyControlProps<T>, 'id'> &
  BarFieldCellProps;


/**
 * One field as a bar holds it: its control at bar size, behind its name where
 * the control does not say what it is. `PropertyField` is the same field as a
 * labeled row.
 *
 * A kind's `control` picks among the forms a line has room for. A radio group
 * draws as segments, a paint as its swatch, and a text area opens from a
 * button, since none of those fit on one.
 */
export function BarField<T extends string = string>(typed: BarFieldProps<T>) {
  const { icon, ...p } = typed as unknown as PropertyControlProps & BarFieldCellProps;
  const o = useOrientation();
  if (p.readOnly) {
    // A value alone does not say what it is a value of, so a readout is always named.
    return (
      <span className={s.field} data-orientation={o}>
        <BarLabel name={p.name} short={p.short} icon={icon} />
        <PropertyReadout {...p} />
      </span>
    );
  }
  switch (p.kind) {
    case 'number':
      return (
        <span className={p.control === 'slider' ? s.field : `${s.field} ${s.number}`} data-orientation={o}>
          <BarLabel name={p.name} short={p.short} icon={icon} />
          <PropertyControl {...p} />
        </span>
      );
    case 'string':
      if (p.control === 'textarea') {
        return (
          <BarPopover label={p.name ?? ''} icon={icon} isDisabled={p.disabled}>
            <PropertyControl {...p} />
          </BarPopover>
        );
      }
      return (
        <span className={`${s.field} ${s.text}`} data-orientation={o}>
          <BarLabel name={p.name} short={p.short} icon={icon} />
          <PropertyControl {...p} />
        </span>
      );
    case 'boolean':
      if (p.control === 'switch') {
        return (
          <span className={s.field} data-orientation={o}>
            <PropertyControl {...p} />
            <span className={s.after} aria-hidden="true">{p.name}</span>
          </span>
        );
      }
      if (p.control === 'checkbox') {
        return (
          <label className={s.field} data-orientation={o}>
            <PropertyControl {...p} />
            <span className={s.after} aria-hidden="true">{p.name}</span>
          </label>
        );
      }
      return (
        <span className={s.field} data-orientation={o}>
          <PropertyControl {...p} control="toggle" />
        </span>
      );
    case 'enum':
      return (
        <span className={s.field} data-orientation={o}>
          <PropertyControl {...p} control={p.control === 'radio' ? 'toggle' : p.control} />
        </span>
      );
    case 'paint':
      return (
        <span className={`${s.field} ${s.paint}`} data-orientation={o}>
          <PropertyControl {...p} control="swatch" />
        </span>
      );
    default:
      return (
        <span className={s.field} data-orientation={o}>
          <PropertyControl {...p} />
        </span>
      );
  }
}

/** True for a kind whose control is a bare box of characters, which a bar names in words. */
export function barLabels(kind: string): boolean {
  return kind === 'number' || kind === 'string';
}

/**
 * The name a bar sets before a value box. Two boxes of characters side by
 * side are indistinguishable; everything else shows what it is. The control
 * keeps `name` as its accessible name, so this is hidden from a screen reader.
 */
export function BarLabel({
  name,
  short,
  icon,
}: {
  name: ReactNode;
  short?: readonly string[];
  icon?: ReactNode;
}) {
  return (
    <span className={s.label} data-bar-label="" aria-hidden="true">
      {icon ?? <FitLabel forms={labelForms(name, short)} />}
    </span>
  );
}
