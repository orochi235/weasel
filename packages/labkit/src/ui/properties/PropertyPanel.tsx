import { type ReactNode, useState } from 'react';
import { dlog } from '../../passthrough/weasel-ui';
import { formatNumber, parseSignedNumber } from '../format';

/** Props for `<PropertyPanel>`. */
export interface PropertyPanelProps {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A titled panel holding property rows — the sidebar container the rest of
 *  this module's components fill. */
export function PropertyPanel({ title, children, className }: PropertyPanelProps) {
  const cls = className ? `lk-property-panel ${className}` : 'lk-property-panel';
  return (
    <div className={cls}>
      {title != null && <h2 className="lk-property-panel__title">{title}</h2>}
      {children}
    </div>
  );
}

/** How a property list packs its rows into two columns. */
export type PropertyListPack = 'auto-color' | 'pairs';

/** Props for `<PropertyList>`. */
export interface PropertyListProps {
  children: ReactNode;
  className?: string;
  /**
   * How rows pack into the 2-column grid.
   *   - `'auto-color'` (default): only color rows pair side-by-side; everything
   *     else spans the full width. Right for sparse top-level panels.
   *   - `'pairs'`: every row auto-places into the 2-column grid two-per-row.
   *     Headers, subpanels, and full-width children (`<hr>`, curve blocks)
   *     still span via `lk-property-list__span`. Right for dense effect bodies.
   */
  pack?: PropertyListPack;
}

/**
 * Grid container for PropertyRows. Use standalone for chrome-less layouts, or
 * nest inside <PropertyPanel/> for the standard glass card.
 */
export function PropertyList({ children, className, pack = 'auto-color' }: PropertyListProps) {
  const packClass = pack === 'pairs' ? ' lk-property-list--pairs' : '';
  const cls = `lk-property-list${packClass}${className ? ` ${className}` : ''}`;
  return <div className={cls}>{children}</div>;
}

/** Which control shape a row holds, which decides its intrinsic layout. */
export type PropertyRowVariant = 'default' | 'color' | 'checkbox';
/** Whether a row's label sits above its control or beside it. */
export type PropertyRowLayout = 'block' | 'inline';

/** Props for `<PropertyRow>`. */
export interface PropertyRowProps {
  label: ReactNode;
  /** Right-aligned readout shown next to the label (e.g. current value). */
  readout?: ReactNode;
  variant?: PropertyRowVariant;
  /**
   * Label position relative to the control. "block" (default) stacks
   * label above control; "inline" places the label to the left.
   * Color and checkbox variants are always inline by their own nature.
   */
  layout?: PropertyRowLayout;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}

/** The label-plus-control frame every typed row below is built from. Use it
 *  directly for a control this module does not cover. */
export function PropertyRow({
  label,
  readout,
  variant = 'default',
  layout = 'block',
  children,
  htmlFor,
  className,
}: PropertyRowProps) {
  const variantClass = variant === 'default' ? '' : ` lk-property-row--${variant}`;
  // Layout only meaningfully applies to the default variant; color and
  // checkbox have their own intrinsic orientation.
  const layoutClass =
    variant === 'default' && layout === 'inline' ? ' lk-property-row--inline' : '';
  const cls = `lk-property-row${variantClass}${layoutClass}${className ? ` ${className}` : ''}`;
  return (
    <label className={cls} htmlFor={htmlFor}>
      <span className="lk-property-row__label">
        {label}
        {readout != null && <em className="lk-property-row__readout">{readout}</em>}
      </span>
      {children}
    </label>
  );
}

// ── Row implementations ──────────────────────────────────────────────

/** Props for `<SliderRow>`. */
export interface SliderRowProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  /** Override how the value is rendered next to the label. Defaults to `value.toString()`. */
  format?: (value: number) => ReactNode;
  /**
   * Optional suffix rendered next to the readout. A string becomes a
   * baseline-aligned dim "word" unit (e.g. "px"); pass JSX like `<sup>°</sup>`
   * to get the browser's native super positioning for symbol units.
   */
  unit?: ReactNode;
  layout?: PropertyRowLayout;
}

/** A bounded number edited by dragging, with a live readout whose precision
 *  follows `step`. */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  unit,
  layout,
}: SliderRowProps) {
  // Default readout precision tracks `step`: integer steps → 0 decimals,
  // 0.1 → 1 decimal, 0.05/0.02/0.01 → 2 decimals, 0.005 → 3, etc. Callers
  // can still pass an explicit `format` to override (e.g. for a custom
  // unit string or a non-decimal display like fractions).
  const decimals = step >= 1 ? 0 : Math.min(6, Math.max(0, Math.ceil(-Math.log10(step))));
  const effectiveFormat = format ?? ((n: number) => formatNumber(n, decimals));
  return (
    <PropertyRow
      label={label}
      readout={
        <EditableReadout
          value={value}
          min={min}
          max={max}
          format={effectiveFormat}
          unit={unit}
          onCommit={onChange}
        />
      }
      layout={layout}
    >
      <input
        type="range"
        tabIndex={-1}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          dlog('property-panel', 'slider', { label, value: v });
          onChange(v);
        }}
      />
    </PropertyRow>
  );
}

interface EditableReadoutProps {
  value: number;
  min: number;
  max: number;
  format?: (value: number) => ReactNode;
  unit?: ReactNode;
  onCommit: (next: number) => void;
}

/**
 * Readout that swaps to a number input on click, commits on Enter/blur,
 * cancels on Escape. Clicks are stopped so the wrapping <label> doesn't
 * forward focus to the slider thumb.
 */
function EditableReadout({ value, min, max, format, unit, onCommit }: EditableReadoutProps) {
  // Draft is non-null only while the input is focused. Live value mirrors
  // into the input otherwise. Pattern mirrors speech-balloons Lab.tsx:893-942.
  const [draft, setDraft] = useState<string | null>(null);
  const fmt = (n: number) => (format ? format(n) : formatNumber(n));
  const displayValue =
    draft !== null
      ? draft
      : (() => {
          const formatted = fmt(value);
          return typeof formatted === 'string' ? formatted : String(formatted);
        })();

  const suffix =
    unit == null ? null : typeof unit === 'string' ? (
      <span className="lk-property-row__readout-unit">{unit}</span>
    ) : (
      unit
    );

  const commit = () => {
    if (draft !== null) {
      const n = parseSignedNumber(draft);
      if (Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, n)));
    }
    setDraft(null);
  };

  return (
    <span className="lk-property-row__readout-group">
      <input
        type="text"
        inputMode="decimal"
        className="lk-property-row__readout-input"
        value={displayValue}
        onFocus={(e) => {
          const formatted = fmt(value);
          setDraft(typeof formatted === 'string' ? formatted : String(formatted));
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value.replace(/-/g, '−'))}
        onBlur={commit}
        onClick={(e) => {
          // Stop the click from reaching the wrapping <label> (which would
          // forward focus to the slider thumb).
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.focus();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
      />
      {suffix}
    </span>
  );
}

/** Props for `<ColorRow>`. */
export interface ColorRowProps {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  /** 0..1 alpha. When provided, a translucent slider renders beneath the swatch. */
  alpha?: number;
  onAlphaChange?: (next: number) => void;
  /**
   * Render the alpha track as inert (dimmed, no thumb, not-allowed cursor).
   * Use when the color's consumer drops alpha so the affordance reads dead.
   */
  alphaDisabled?: boolean;
}

/** A color swatch, optionally with an alpha slider beneath it. */
export function ColorRow({
  label,
  value,
  onChange,
  alpha,
  onAlphaChange,
  alphaDisabled,
}: ColorRowProps) {
  const showAlpha = alpha != null;
  const className = alphaDisabled ? 'lk-property-row--alpha-disabled' : undefined;
  return (
    <PropertyRow label={label} variant="color" className={className}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      {showAlpha && (
        <input
          type="range"
          className="lk-property-row__alpha"
          min={0}
          max={1}
          step={0.01}
          value={alpha}
          disabled={alphaDisabled}
          onChange={(e) => onAlphaChange?.(Number(e.target.value))}
        />
      )}
    </PropertyRow>
  );
}

/** Props for `<CheckboxRow>`. */
export interface CheckboxRowProps {
  label: ReactNode;
  value: boolean;
  onChange: (next: boolean) => void;
}

/** A boolean checkbox. */
export function CheckboxRow({ label, value, onChange }: CheckboxRowProps) {
  return (
    <PropertyRow label={label} variant="checkbox">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </PropertyRow>
  );
}

/** Props for `<TextRow>`. */
export interface TextRowProps {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
  layout?: PropertyRowLayout;
}

/** A single-line text input. */
export function TextRow({ label, value, onChange, placeholder, maxLength, layout }: TextRowProps) {
  return (
    <PropertyRow label={label} layout={layout}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </PropertyRow>
  );
}

/** Props for `<NumberRow>`. */
export interface NumberRowProps {
  label: ReactNode;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  layout?: PropertyRowLayout;
}

/** A number typed directly. Reach for `<SliderRow>` when the range matters
 *  more than the exact value. */
export function NumberRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  layout,
}: NumberRowProps) {
  return (
    <PropertyRow label={label} layout={layout}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return;
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </PropertyRow>
  );
}

export interface SelectOption<T extends string> {
  value: T;
  label: ReactNode;
}

/** Props for `<SelectRow>`. */
export interface SelectRowProps<T extends string> {
  label: ReactNode;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (next: T) => void;
  layout?: PropertyRowLayout;
}

/** A dropdown over a fixed set of choices. Prefer `<ToggleRow>` when there
 *  are only two or three and they should all stay visible. */
export function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
  layout,
}: SelectRowProps<T>) {
  return (
    <PropertyRow label={label} layout={layout}>
      <select
        value={value}
        onChange={(e) => {
          const v = e.target.value as T;
          dlog('property-panel', 'select', { label, value: v });
          onChange(v);
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {/* HTML <option> only renders text; ReactNode → string coerce */}
            {opt.label as string}
          </option>
        ))}
      </select>
    </PropertyRow>
  );
}

/** Props for `<ToggleRow>`. */
export interface ToggleRowProps<T extends string> {
  label: ReactNode;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (next: T) => void;
  layout?: PropertyRowLayout;
}

/** A segmented control: the same choice as a select, with every option
 *  visible at once. */
export function ToggleRow<T extends string>({
  label,
  value,
  options,
  onChange,
  layout,
}: ToggleRowProps<T>) {
  return (
    <PropertyRow label={label} layout={layout}>
      <div className="lk-property-row__toggle">
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              className={
                selected
                  ? 'lk-property-row__toggle-button lk-property-row__toggle-button--selected'
                  : 'lk-property-row__toggle-button'
              }
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </PropertyRow>
  );
}
