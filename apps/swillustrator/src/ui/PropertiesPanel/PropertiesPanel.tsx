import type { ReactNode, ChangeEvent } from 'react';
import { SidebarPanel, type SidebarPanelProps } from '@orochi235/weasel-ui';
import s from './PropertiesPanel.module.css';

/** Convenience composition: a `SidebarPanel` whose body is a
 *  12-column property grid. Use directly when the panel content is a
 *  set of `PropertyRow`s. For panels with free-form content (a list, a
 *  custom widget), call `SidebarPanel` straight from `@orochi235/weasel-ui`
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

export function PropertyMiniLabel(props: { children: ReactNode; span?: 1 | 2 | 3 | 4 }) {
  return <span className={`${s.miniLabel} ${spanClass(props.span ?? 2)}`}>{props.children}</span>;
}

export function PropertyReadOnly(props: { children: ReactNode; span?: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 }) {
  return <span className={`${s.readOnly} ${spanClass(props.span ?? 12)}`}>{props.children}</span>;
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

export function PropertyNumberInput(props: {
  value: number;
  onChange: (v: number) => void;
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <input
      className={`${s.input} ${spanClass(props.span ?? 4)}`}
      type="number"
      step={props.step ?? 1}
      min={props.min}
      max={props.max}
      value={Number.isFinite(props.value) ? props.value : 0}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const n = parseFloat(e.target.value);
        props.onChange(Number.isFinite(n) ? n : 0);
      }}
    />
  );
}

/** Slider + small numeric field. Slider takes most of the row; the
 *  numeric input shows the precise value and accepts direct edits. */
export function PropertySliderInput(props: {
  value: number;
  onChange: (v: number) => void;
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
  step?: number;
  min?: number;
  max?: number;
}) {
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const step = props.step ?? 1;
  return (
    <div className={`${s.sliderRow} ${spanClass(props.span ?? 12)}`}>
      <input
        type="range"
        className={s.slider}
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(props.value) ? props.value : 0}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const n = parseFloat(e.target.value);
          props.onChange(Number.isFinite(n) ? n : 0);
        }}
      />
      <input
        type="number"
        className={`${s.input} ${s.sliderNumber}`}
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(props.value) ? props.value : 0}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const n = parseFloat(e.target.value);
          props.onChange(Number.isFinite(n) ? n : 0);
        }}
      />
    </div>
  );
}

/** A single mini-label + number input pair, taking 6 of 12 columns
 *  (2 + 4). Compose two of these in a PropertyRow for X/Y or W/H. */
export function PropertyAxisInput(props: {
  axis: ReactNode;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <>
      <PropertyMiniLabel span={2}>{props.axis}</PropertyMiniLabel>
      <PropertyNumberInput
        value={props.value}
        onChange={props.onChange}
        span={4}
        step={props.step}
        min={props.min}
        max={props.max}
      />
    </>
  );
}

export function PropertyColorInput(props: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      className={`${s.colorInput} ${s.span12}`}
      type="color"
      value={props.value.slice(0, 7)}
      onChange={(e: ChangeEvent<HTMLInputElement>) => props.onChange(e.target.value)}
    />
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

/** Grid of color swatches. Spans the full row (12 cols). */
export function PropertySwatchGrid(props: {
  value: string;
  options: { value: string; label?: string }[];
  onChange: (v: string) => void;
  /** Number of columns in the swatch grid (default 6). Visual only —
   *  the grid itself always spans all 12 value columns of the panel. */
  columns?: number;
}) {
  const cols = props.columns ?? 6;
  return (
    <div
      className={`${s.swatchGrid} ${s.span12}`}
      style={cols === 6 ? undefined : { gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`${s.swatch}${o.value === props.value ? ` ${s.swatchActive}` : ''}`}
          style={{ background: o.value }}
          title={o.label ?? o.value}
          onClick={() => props.onChange(o.value)}
        />
      ))}
    </div>
  );
}

export function PropertyButton(props: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
}) {
  const variantClass = props.variant === 'danger' ? ` ${s.danger}` : '';
  return (
    <button
      type="button"
      className={`${s.button} ${spanClass(props.span ?? 12)}${variantClass}`}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
