import { type ReactNode, useState } from 'react';
import { Focusable } from 'react-aria-components';
import { dlog } from '../../dlog';
import { formatNumber, parseSignedNumber } from '../../format/number';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import shared from '../range.module.css';
import s from './Properties.module.css';

/**
 * How much room a container gives its rows — gaps, padding, and field height,
 * moved together. Set on any container in the family; it reaches every
 * descendant, so an inner group can differ from the panel around it.
 */
export type PropertyDensity = 'tight' | 'normal' | 'roomy';

/** Where an inline row's label and control sit on the row's cross axis. Set on
 *  a container to line a whole column of them up. */
export type PropertyAlign = 'start' | 'center' | 'end' | 'baseline';

/** Metric props every container in the family takes. Both reach descendants,
 *  so the nearest container that states one wins. */
export interface PropertyMetricProps {
  /** Room the rows get. Unset inherits from an outer container, else `normal`. */
  density?: PropertyDensity;
  /**
   * Cross-axis alignment of an inline row's label and control. `baseline` sits
   * the control on the label's first-line baseline, which is what lines a
   * column of swatches up against labels of different heights. Unset keeps each
   * variant's own alignment — a color row centers its label and swatch and
   * sinks the pair to the row's bottom edge, which keeps a paired alpha track
   * level with its neighbour.
   */
  align?: PropertyAlign;
}

const DENSITY_CLASS: Record<PropertyDensity, string> = {
  tight: s.densityTight,
  normal: s.densityNormal,
  roomy: s.densityRoomy,
};

const ALIGN_CLASS: Record<PropertyAlign, string> = {
  start: s.alignStart,
  center: s.alignCenter,
  end: s.alignEnd,
  baseline: s.alignBaseline,
};

/** Joins a container's base class with its metric classes and the consumer's.
 *  Exported for the family's other files, which share the same two props. */
export function propertyMetricClass(
  base: string,
  { density, align }: PropertyMetricProps,
  className?: string,
): string {
  return [base, density && DENSITY_CLASS[density], align && ALIGN_CLASS[align], className]
    .filter(Boolean)
    .join(' ');
}

/** Props for `<PropertyPanel>`. */
export interface PropertyPanelProps extends PropertyMetricProps {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A titled panel holding property rows — the sidebar container the rest of
 *  this module's components fill. */
export function PropertyPanel({
  title,
  children,
  className,
  density,
  align,
}: PropertyPanelProps) {
  return (
    <div className={propertyMetricClass(s.panel, { density, align }, className)}>
      {title != null && <h2 className={s.panelTitle}>{title}</h2>}
      {children}
    </div>
  );
}

/** How a property list packs its rows into two columns. */
export type PropertyListPack = 'auto-color' | 'pairs' | 'one-up';

/** Props for `<PropertyList>`. */
export interface PropertyListProps extends PropertyMetricProps {
  children: ReactNode;
  className?: string;
  /**
   * How rows pack into the 2-column grid.
   *   - `'auto-color'` (default): only color rows pair side-by-side; everything
   *     else spans the full width. Right for sparse top-level panels.
   *   - `'pairs'`: every row auto-places into the 2-column grid two-per-row.
   *     Headers and subpanels still span the full width; wrap any other
   *     full-width child in `<PropertySpan>`. Right for dense effect bodies.
   *   - `'one-up'`: every row spans the full width, color rows included. Right
   *     for a palette — a column of swatches read as a group.
   */
  pack?: PropertyListPack;
}

/**
 * Grid container for PropertyRows. Use standalone for chrome-less layouts, or
 * nest inside <PropertyPanel/> for the standard glass card.
 */
export function PropertyList({
  children,
  className,
  pack = 'auto-color',
  density,
  align,
}: PropertyListProps) {
  const base = `${s.list}${pack === 'pairs' ? ` ${s.listPairs}` : pack === 'one-up' ? ` ${s.listOneUp}` : ''}`;
  return <div className={propertyMetricClass(base, { density, align }, className)}>{children}</div>;
}

/** Props for `<PropertySpan>`. */
export interface PropertySpanProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper that makes an arbitrary child span both columns of a
 * `<PropertyList pack="pairs">`, a `<PropertyGroup pack="pairs">` body, or a
 * `<Subpanel>`. `<PropertyRow span>` covers the row case; this covers
 * everything else a consumer puts in the grid.
 */
export function PropertySpan({ children, className }: PropertySpanProps) {
  return <div className={className ? `${s.span} ${className}` : s.span}>{children}</div>;
}

/** Which control shape a row holds, which decides its intrinsic layout. */
export type PropertyRowVariant = 'default' | 'color' | 'checkbox';
/** Whether a row's label sits above its control or beside it. */
export type PropertyRowLayout = 'block' | 'inline';

/** Props for `<PropertyRow>`. */
export interface PropertyRowProps extends PropertyMetricProps {
  label: ReactNode;
  /** Right-aligned readout shown next to the label (e.g. current value). */
  readout?: ReactNode;
  /**
   * Help text for the row, shown in a tooltip off an ⓘ affordance beside the
   * label. Empty or absent renders no affordance.
   */
  description?: string;
  variant?: PropertyRowVariant;
  /**
   * Label position relative to the control. Unset takes the variant's own
   * orientation: `block` — label above control — for the default variant, and
   * `inline` for the color and checkbox variants, which read as a row.
   */
  layout?: PropertyRowLayout;
  /**
   * Take the full width of the enclosing grid. Only has an effect inside a
   * `<PropertyList pack="pairs">` or a `<Subpanel>`; elsewhere rows are already
   * full width.
   */
  span?: boolean;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}

/** The label-plus-control frame every typed row below is built from. Use it
 *  directly for a control this module does not cover. */
export function PropertyRow({
  label,
  readout,
  description,
  variant = 'default',
  layout,
  span,
  children,
  htmlFor,
  className,
  density,
  align,
}: PropertyRowProps) {
  const variantClass = variant === 'color' ? s.rowColor : variant === 'checkbox' ? s.rowCheckbox : '';
  // Each variant already lays out one way; a class is only needed for the
  // other one. The default variant stacks, so it needs `.rowInline`; color and
  // checkbox read as a row, so they need `.rowBlock`.
  const intrinsic: PropertyRowLayout = variant === 'default' ? 'block' : 'inline';
  const resolved = layout ?? intrinsic;
  const layoutClass =
    resolved === intrinsic ? '' : resolved === 'inline' ? s.rowInline : s.rowBlock;
  const cls = propertyMetricClass(
    [s.row, variantClass, layoutClass, span && s.span].filter(Boolean).join(' '),
    { density, align },
    className,
  );
  return (
    <label className={cls} htmlFor={htmlFor}>
      <span className={s.rowLabel}>
        {label}
        {description ? <PropertyRowHelp label={label} description={description} /> : null}
        {readout != null && <em className={s.readout}>{readout}</em>}
      </span>
      {children}
    </label>
  );
}

/** Tooltip trigger for a row's `description`. A tooltip trigger has to be
 *  interactive to be keyboard-reachable, so this is a real button. */
function PropertyRowHelp({ label, description }: { label: ReactNode; description: string }) {
  const name = typeof label === 'string' ? label : 'this setting';
  return (
    <TooltipTrigger>
      <Focusable>
        <button
          type="button"
          className={s.help}
          aria-label={`About ${name}`}
          onClick={(e) => {
            // The wrapping <label> would otherwise actuate the row's control.
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          ⓘ
        </button>
      </Focusable>
      <Tooltip>{description}</Tooltip>
    </TooltipTrigger>
  );
}

// ── Row implementations ──────────────────────────────────────────────

/** Props for `<SliderRow>`. */
export interface SliderRowProps extends PropertyMetricProps {
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
  description?: string;
  /** Take the full width of the enclosing grid — see `<PropertyRow span>`. */
  span?: boolean;
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
  description,
  span,
  density,
  align,
}: SliderRowProps) {
  // Default readout precision tracks `step`: integer steps → 0 decimals,
  // 0.1 → 1 decimal, 0.05/0.02/0.01 → 2 decimals, 0.005 → 3, etc. Callers
  // can still pass an explicit `format` to override (e.g. for a custom
  // unit string or a non-decimal display like fractions).
  const decimals = step >= 1 ? 0 : Math.min(6, Math.max(0, Math.ceil(-Math.log10(step))));
  const effectiveFormat =
    format ??
    ((n: number) =>
      formatNumber(n, {
        useGrouping: false,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }));
  return (
    <PropertyRow
      span={span}
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
      description={description}
      density={density}
      align={align}
    >
      <input
        type="range"
        className={shared.range}
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
  const fmt = (n: number) =>
    format ? format(n) : formatNumber(n, { useGrouping: false, maximumFractionDigits: 20 });
  const displayValue =
    draft !== null
      ? draft
      : (() => {
          const formatted = fmt(value);
          return typeof formatted === 'string' ? formatted : String(formatted);
        })();

  const suffix =
    unit == null ? null : typeof unit === 'string' ? (
      <span className={s.readoutUnit}>{unit}</span>
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
    <span className={s.readoutGroup}>
      <input
        type="text"
        inputMode="decimal"
        className={s.readoutInput}
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
export interface ColorRowProps extends PropertyMetricProps {
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
  /** Label beside the swatch (default) or above it. */
  layout?: PropertyRowLayout;
  description?: string;
  /** Take the full width of the enclosing grid — see `<PropertyRow span>`. */
  span?: boolean;
}

/** A color swatch, optionally with an alpha slider beneath it. */
export function ColorRow({
  label,
  value,
  onChange,
  alpha,
  onAlphaChange,
  alphaDisabled,
  layout,
  description,
  span,
  density,
  align,
}: ColorRowProps) {
  const showAlpha = alpha != null;
  return (
    <PropertyRow
      span={span}
      label={label}
      variant="color"
      layout={layout}
      description={description}
      density={density}
      align={align}
    >
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      {showAlpha && (
        <input
          type="range"
          className={`${shared.range} ${shared.alpha} ${s.alpha}`}
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
export interface CheckboxRowProps extends PropertyMetricProps {
  label: ReactNode;
  value: boolean;
  onChange: (next: boolean) => void;
  /** Label beside the box (default) or above it. */
  layout?: PropertyRowLayout;
  description?: string;
  /** Take the full width of the enclosing grid — see `<PropertyRow span>`. */
  span?: boolean;
}

/** A boolean checkbox. */
export function CheckboxRow({
  label,
  value,
  onChange,
  layout,
  span,
  description,
  density,
  align,
}: CheckboxRowProps) {
  return (
    <PropertyRow
      span={span}
      label={label}
      variant="checkbox"
      layout={layout}
      description={description}
      density={density}
      align={align}
    >
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </PropertyRow>
  );
}

/** Props for `<TextRow>`. */
export interface TextRowProps extends PropertyMetricProps {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
  layout?: PropertyRowLayout;
  description?: string;
  /** Take the full width of the enclosing grid — see `<PropertyRow span>`. */
  span?: boolean;
}

/** A single-line text input. */
export function TextRow({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  layout,
  description,
  span,
  density,
  align,
}: TextRowProps) {
  return (
    <PropertyRow
      span={span}
      label={label}
      layout={layout}
      description={description}
      density={density}
      align={align}
    >
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
export interface NumberRowProps extends PropertyMetricProps {
  label: ReactNode;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /**
   * Optional suffix rendered after the field. A string becomes a dim "word"
   * unit (e.g. "px"); pass JSX like `<sup>°</sup>` for symbol units. Display
   * only — it never participates in parsing, and the value stays a number.
   */
  unit?: ReactNode;
  layout?: PropertyRowLayout;
  description?: string;
  /** Take the full width of the enclosing grid — see `<PropertyRow span>`. */
  span?: boolean;
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
  unit,
  layout,
  description,
  span,
  density,
  align,
}: NumberRowProps) {
  const input = (
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
  );
  return (
    <PropertyRow
      span={span}
      label={label}
      layout={layout}
      description={description}
      density={density}
      align={align}
    >
      {unit == null ? (
        input
      ) : (
        <span className={s.fieldUnitGroup}>
          {input}
          {typeof unit === 'string' ? <span className={s.readoutUnit}>{unit}</span> : unit}
        </span>
      )}
    </PropertyRow>
  );
}

export interface PropertyOption<T extends string> {
  value: T;
  label: ReactNode;
}

/** Props for `<SelectRow>`. */
export interface SelectRowProps<T extends string> extends PropertyMetricProps {
  label: ReactNode;
  value: T;
  options: ReadonlyArray<PropertyOption<T>>;
  onChange: (next: T) => void;
  layout?: PropertyRowLayout;
  description?: string;
  /** Take the full width of the enclosing grid — see `<PropertyRow span>`. */
  span?: boolean;
}

/** A dropdown over a fixed set of choices. Prefer `<ToggleRow>` when there
 *  are only two or three and they should all stay visible. */
export function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
  layout,
  description,
  span,
  density,
  align,
}: SelectRowProps<T>) {
  return (
    <PropertyRow
      span={span}
      label={label}
      layout={layout}
      description={description}
      density={density}
      align={align}
    >
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
export interface ToggleRowProps<T extends string> extends PropertyMetricProps {
  label: ReactNode;
  value: T;
  options: ReadonlyArray<PropertyOption<T>>;
  onChange: (next: T) => void;
  layout?: PropertyRowLayout;
  description?: string;
  /** Take the full width of the enclosing grid — see `<PropertyRow span>`. */
  span?: boolean;
}

/** A segmented control: the same choice as a select, with every option
 *  visible at once. */
export function ToggleRow<T extends string>({
  label,
  value,
  options,
  onChange,
  layout,
  description,
  span,
  density,
  align,
}: ToggleRowProps<T>) {
  return (
    <PropertyRow
      span={span}
      label={label}
      layout={layout}
      description={description}
      density={density}
      align={align}
    >
      <div className={s.toggle}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              className={
                selected ? `${s.toggleButton} ${s.toggleButtonSelected}` : s.toggleButton
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
