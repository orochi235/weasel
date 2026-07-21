import { useRef, useState, type ReactNode, type ChangeEvent } from 'react';
import { SidebarPanel, type SidebarPanelProps } from '@weasel-js/ui';
import { toHex8, getAlpha01, withAlpha01, useActionsRegistry, type UiOngoingControl } from '@weasel-js/core';
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

/** Color + alpha picker. Native `<input type=color>` only round-trips
 *  `#rrggbb`, so an adjacent range input drives the alpha channel
 *  independently. Both controls write `#rrggbbaa` so every consumer
 *  carries opacity through the same string.
 *
 *  Two prop shapes are supported:
 *  - Action-based (preferred): pass `colorActionId` + `opacityActionId` to
 *    dispatch via `registry.begin/update/end`. The color picker sends
 *    `{ color: string }` params; the opacity slider sends `{ alpha01: number }`.
 *  - Legacy fallback: pass `onChange` for cases where no registry action
 *    exists (e.g. local React state). */
export function PropertyColorInput(props: {
  value: string;
  colorActionId: string;
  opacityActionId: string;
  onChange?: never;
} | {
  value: string;
  /** @deprecated Use `colorActionId` + `opacityActionId` instead. Legacy
   *  path retained only for local-React-state edits (e.g. background color)
   *  where no scene action applies. */
  onChange: (v: string) => void;
  colorActionId?: never;
  opacityActionId?: never;
}) {
  const actions = useActionsRegistry();
  const hex8 = toHex8(props.value);
  const rgb6 = hex8.startsWith('#') && hex8.length >= 7 ? hex8.slice(0, 7) : '#000000';
  const alpha01 = getAlpha01(hex8);
  const alphaPct = Math.round(alpha01 * 100);
  const colorCtrlRef = useRef<UiOngoingControl | null>(null);
  const opacityCtrlRef = useRef<UiOngoingControl | null>(null);
  // Action-based dispatch doesn't synchronously refresh `props.value`
  // (the registry batches scene writes until end('commit')), so a
  // controlled `<input value={alphaPct}>` snaps the thumb back to the
  // pre-drag value mid-drag. Track a local draft while the slider is
  // active so the thumb visually follows the pointer; fall back to
  // `props.value` once the drag commits.
  const [opacityDraft, setOpacityDraft] = useState<number | null>(null);
  const visibleAlphaPct = opacityDraft ?? alphaPct;

  /** Color picker commit uses `blur` (fires when the native picker closes
   *  and focus leaves the input). Chrome fires `change` continuously during
   *  picker interaction (per HTML spec), so commit-on-change would emit
   *  one undo entry per tick. */
  function dispatchColor(v: string, phase: 'input' | 'commit'): void {
    if ('onChange' in props && props.onChange) {
      if (phase === 'input') props.onChange(withAlpha01(v, alpha01));
      return;
    }
    if (phase === 'input') {
      if (!colorCtrlRef.current) {
        colorCtrlRef.current = actions?.begin(props.colorActionId, { color: v }) ?? null;
      } else {
        colorCtrlRef.current.update({ color: v });
      }
      return;
    }
    // commit
    if (colorCtrlRef.current) {
      colorCtrlRef.current.end('commit');
      colorCtrlRef.current = null;
    }
  }

  /** Slider commit uses pointer/key events rather than `onChange`. The range
   *  input fires `change` on every value tick (per HTML spec), so commit-on-
   *  change would emit one undo entry per tick during a drag. Pointer/key
   *  end events give us true drag-end semantics. */
  function dispatchOpacity(a: number, phase: 'input' | 'commit'): void {
    if ('onChange' in props && props.onChange) {
      if (phase === 'input') props.onChange(withAlpha01(hex8, a));
      return;
    }
    if (phase === 'input') {
      if (!opacityCtrlRef.current) {
        opacityCtrlRef.current = actions?.begin(props.opacityActionId, { alpha01: a }) ?? null;
      } else {
        opacityCtrlRef.current.update({ alpha01: a });
      }
      return;
    }
    // commit
    if (opacityCtrlRef.current) {
      opacityCtrlRef.current.end('commit');
      opacityCtrlRef.current = null;
    }
  }

  return (
    <span className={`${s.colorInputRow} ${s.span12}`}>
      <input
        className={s.colorInput}
        type="color"
        value={rgb6}
        onInput={(e) => dispatchColor((e.target as HTMLInputElement).value, 'input')}
        onBlur={() => dispatchColor(rgb6, 'commit')}
      />
      <input
        className={s.alphaRange}
        type="range"
        min={0}
        max={100}
        step={1}
        value={visibleAlphaPct}
        title="Opacity"
        aria-label="Opacity"
        onInput={(e) => {
          const pct = Number((e.target as HTMLInputElement).value);
          setOpacityDraft(pct);
          dispatchOpacity(pct / 100, 'input');
        }}
        onPointerUp={() => { dispatchOpacity(alpha01, 'commit'); setOpacityDraft(null); }}
        onPointerCancel={() => { dispatchOpacity(alpha01, 'commit'); setOpacityDraft(null); }}
        onKeyUp={() => { dispatchOpacity(alpha01, 'commit'); setOpacityDraft(null); }}
        onBlur={() => { dispatchOpacity(alpha01, 'commit'); setOpacityDraft(null); }}
      />
      <span className={s.alphaReadout}>{visibleAlphaPct}</span>
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
      className={`${s.swatchGrid} ${s.span12}`}
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
