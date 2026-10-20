import type { CSSProperties, ReactNode } from 'react';
import { paintKindOf } from '@weasel-js/core';
import { qty } from '@weasel-js/quantity';
import { stepDisplay } from './NumberControls';
import type { PropertyControlProps, PropertyNumberFieldProps } from './fieldTypes';
import s from './PropertyReadout.module.css';

/**
 * A field shown as its value and nothing to edit it with: what a `readOnly`
 * field draws in place of its control. The words are the ones the control
 * would show — an enum's option label, a number in its display with its unit,
 * a color as a swatch beside its hex — so it reads as a value, not a control
 * someone switched off.
 */
export function PropertyReadout(p: PropertyControlProps) {
  return (
    <output id={p.id} className={p.className ? `${s.readout} ${p.className}` : s.readout} aria-label={p.name} data-readout="">
      {readoutBody(p)}
    </output>
  );
}

function readoutBody(p: PropertyControlProps): ReactNode {
  if (p.mixed) return <span className={s.none}>Mixed</span>;
  switch (p.kind) {
    case 'boolean':
      return p.value === true ? 'On' : 'Off';
    case 'number':
      return numberText(p);
    case 'enum': {
      const option = p.options.find((o) => o.value === p.value);
      if (!option) return none();
      return <>{option.glyph}{option.label}</>;
    }
    case 'color':
      return p.value ? <><Swatch color={p.value} />{p.value}</> : none();
    case 'paint': {
      if (p.value === null) return 'None';
      if (p.value === undefined) return none();
      const solid = p.value.kind === undefined || p.value.kind === 'solid' ? (p.value as { color: string }).color : undefined;
      if (solid !== undefined) return <><Swatch color={solid} />{solid}</>;
      return paintKindOf(p.value)?.label ?? p.value.kind;
    }
    case 'string':
    case 'font-family':
      return p.value ? p.value : none();
    case 'font-weight':
      return p.value === undefined ? none() : String(p.value);
    default: {
      const _exhaustive: never = p;
      return String((_exhaustive as { value?: unknown }).value ?? '');
    }
  }
}

function none(): ReactNode {
  return <span className={s.none}>—</span>;
}

function numberText(p: PropertyNumberFieldProps): ReactNode {
  if (typeof p.value !== 'number' || Number.isNaN(p.value)) return none();
  const text = p.format ? p.format(p.value) : qty(p.value, p.display ?? stepDisplay(p.step)).text;
  if (p.unit == null || !Number.isFinite(p.value)) return text;
  return <>{text}<span className={s.unit} data-wzl-subordinate="">{p.unit}</span></>;
}

/** A chip of `color`, which is data and so reaches the stylesheet as a custom property. Also what a menu color row shows. */
export function Swatch({ color }: { color: string }) {
  return <span className={s.swatch} aria-hidden="true" style={{ '--readout-swatch': color } as CSSProperties} />;
}
