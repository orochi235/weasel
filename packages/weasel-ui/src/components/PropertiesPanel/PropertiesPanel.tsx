import type { ReactNode, ChangeEvent } from 'react';
import s from './PropertiesPanel.module.css';

/** Outer panel shell — provides the title row and the 12-column grid.
 *  Children are rendered into the grid; lay them out with PropertyRow
 *  or by composing PropertyLabel + PropertyField directly.
 *
 *  When `collapsed` is true, only the title row paints. Click the title (or
 *  the chevron) to toggle via `onToggleCollapse`. An optional `onHide`
 *  exposes a close button that removes the panel from the parent UI
 *  entirely (the consumer's prefs map is the source of truth for both
 *  states — this component is pure presentation). */
export function PropertiesPanel(props: {
  title?: ReactNode;
  children?: ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onHide?: () => void;
}) {
  const { title, children, collapsed, onToggleCollapse, onHide } = props;
  const headerInteractive = onToggleCollapse !== undefined;
  return (
    <div className={`${s.panel}${collapsed ? ` ${s.collapsed}` : ''}`}>
      {title !== undefined && (
        <div className={s.titleRow}>
          {headerInteractive ? (
            <button
              type="button"
              className={s.titleButton}
              onClick={onToggleCollapse}
              aria-expanded={!collapsed}
            >
              <span className={`${s.chevron}${collapsed ? ` ${s.chevronCollapsed}` : ''}`} aria-hidden="true">▾</span>
              <span className={s.title}>{title}</span>
            </button>
          ) : (
            <span className={s.title}>{title}</span>
          )}
          {onHide !== undefined && (
            <button
              type="button"
              className={s.hideButton}
              onClick={onHide}
              title="Hide panel"
              aria-label="Hide panel"
            >
              ×
            </button>
          )}
        </div>
      )}
      {!collapsed && <div className={s.grid}>{children}</div>}
    </div>
  );
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
