import type { ReactNode, ChangeEvent } from 'react';
import { SidebarPanel, type SidebarPanelProps } from '@weasel-js/ui';
import { toHex8, getAlpha01, withAlpha01 } from '@weasel-js/core';
import s from './PropertiesPanel.module.css';

/** Convenience composition: a `SidebarPanel` whose body is a
 *  12-column property grid. Use directly when the panel content is a
 *  set of `PropertyRow`s. For panels with free-form content (a list, a
 *  custom widget), call `SidebarPanel` straight from `@weasel-js/ui`
 *  and skip the grid. */
export type PropertiesPanelProps = SidebarPanelProps;

export function PropertiesPanel(props: PropertiesPanelProps) {
  const { children, ...chrome } = props;
  return (
    <SidebarPanel {...chrome}>
      <PropertiesGrid>{children}</PropertiesGrid>
    </SidebarPanel>
  );
}

/** Standalone 12-column grid — body slot for a `SidebarPanel` when the
 *  panel holds property rows. Exposed separately so consumers can opt
 *  out of the grid for free-form content. */
export function PropertiesGrid({ children }: { children?: ReactNode }) {
  return <div className={s.grid}>{children}</div>;
}

/** Label in column 1 + value cells (default span 12) in the grid. */
export function PropertyRow(props: {
  label?: ReactNode;
  /** Total span the children occupy across the 12 value columns.
   *  Defaults to 12 (full row). Set lower if you want trailing space. */
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
  children: ReactNode;
}) {
  const span = props.span ?? 12;
  return (
    <>
      <span className={s.label}>{props.label ?? ''}</span>
      <div className={spanClass(span)} style={{ display: 'contents' }}>
        {props.children}
      </div>
    </>
  );
}

function spanClass(n: number): string {
  switch (n) {
    case 1: return s.span1;
    case 2: return s.span2;
    case 3: return s.span3;
    case 4: return s.span4;
    case 5: return s.span5;
    case 6: return s.span6;
    case 8: return s.span8;
    case 10: return s.span10;
    default: return s.span12;
  }
}

export function PropertyTextInput(props: {
  value: string;
  onChange: (v: string) => void;
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
  placeholder?: string;
}) {
  return (
    <input
      className={`${s.input} ${spanClass(props.span ?? 12)}`}
      type="text"
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => props.onChange(e.target.value)}
    />
  );
}

/** Color + alpha picker. Native `<input type=color>` only round-trips
 *  `#rrggbb`, so an adjacent range input drives the alpha channel
 *  independently. Both controls write `#rrggbbaa`. */
export function PropertyColorInput(props: {
  value: string;
  onChange: (v: string) => void;
}) {
  const hex8 = toHex8(props.value);
  const rgb6 = hex8.startsWith('#') && hex8.length >= 7 ? hex8.slice(0, 7) : '#000000';
  const alpha01 = getAlpha01(hex8);
  const alphaPct = Math.round(alpha01 * 100);

  return (
    <span className={`${s.colorInputRow} ${s.span12}`}>
      <input
        className={s.colorInput}
        type="color"
        value={rgb6}
        onInput={(e) => props.onChange(withAlpha01((e.target as HTMLInputElement).value, alpha01))}
      />
      <input
        className={s.alphaRange}
        type="range"
        min={0}
        max={100}
        step={1}
        value={alphaPct}
        title="Opacity"
        aria-label="Opacity"
        onInput={(e) => props.onChange(withAlpha01(hex8, Number((e.target as HTMLInputElement).value) / 100))}
      />
      <span className={s.alphaReadout}>{alphaPct}</span>
    </span>
  );
}

export function PropertySelect<T extends string>(props: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
}) {
  return (
    <select
      className={`${s.select} ${spanClass(props.span ?? 12)}`}
      value={props.value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => props.onChange(e.target.value as T)}
    >
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

/** Grid of color swatches. Spans the full row (12 cols).
 *
 *  A `value: null` entry renders as the transparent/"no paint" swatch
 *  (checkerboard + red diagonal). The consumer maps null to whatever
 *  "no fill" / "no stroke" state means in its model. */
export function PropertySwatchGrid(props: {
  value: string | null;
  options: { value: string | null; label?: string }[];
  onChange: (v: string | null) => void;
  /** Alt-target handler — fires on right-click (browser menu suppressed)
   *  AND on shift-click. Used by the Colors panel to route left-click →
   *  fill, right-click / shift-click → stroke. */
  onAltChange?: (v: string | null) => void;
  /** Number of columns in the swatch grid (default 6). Visual only —
   *  the grid itself always spans all 12 value columns of the panel. */
  columns?: number;
}) {
  const cols = props.columns ?? 6;
  const { onAltChange } = props;
  return (
    <div
      className={s.swatchGrid}
      style={cols === 6 ? undefined : { gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {props.options.map((o, i) => {
        const isNull = o.value === null;
        const active = o.value === props.value;
        return (
          <button
            key={o.value ?? `__null_${i}`}
            type="button"
            className={`${s.swatch}${isNull ? ` ${s.swatchTransparent}` : ''}${active ? ` ${s.swatchActive}` : ''}`}
            style={isNull ? undefined : { background: o.value! }}
            title={o.label ?? (isNull ? 'None' : o.value!)}
            onClick={(e) => {
              if (onAltChange && e.shiftKey) onAltChange(o.value);
              else props.onChange(o.value);
            }}
            onContextMenu={onAltChange ? (e) => { e.preventDefault(); onAltChange(o.value); } : undefined}
          />
        );
      })}
    </div>
  );
}
