import { useState, type ReactNode } from 'react';
import { formatNumber, parseSignedNumber } from '../format';

export interface PropertyPanelProps {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PropertyPanel({ title, children, className }: PropertyPanelProps) {
  const cls = className ? `lk-property-panel ${className}` : 'lk-property-panel';
  return (
    <div className={cls}>
      {title != null && <h2 className="lk-property-panel__title">{title}</h2>}
      {children}
    </div>
  );
}

export interface PropertyListProps {
  children: ReactNode;
  className?: string;
}

/**
 * Grid container for PropertyRows. Arranges rows in a 2-column grid where
 * consecutive ColorRows pair side-by-side and every other row spans full width.
 * Use standalone for chrome-less layouts, or nest inside <PropertyPanel/> for
 * the standard glass card.
 */
export function PropertyList({ children, className }: PropertyListProps) {
  const cls = className ? `lk-property-list ${className}` : 'lk-property-list';
  return <div className={cls}>{children}</div>;
}

export type PropertyRowVariant = 'default' | 'color' | 'checkbox';
export type PropertyRowLayout = 'block' | 'inline';

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

export interface SliderRowProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  /** Override how the value is rendered next to the label. Defaults to `value.toString()`. */
  format?: (value: number) => ReactNode;
  layout?: PropertyRowLayout;
}

export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  layout,
}: SliderRowProps) {
  return (
    <PropertyRow
      label={label}
      readout={
        <EditableReadout
          value={value}
          min={min}
          max={max}
          step={step}
          format={format}
          onCommit={onChange}
        />
      }
      layout={layout}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </PropertyRow>
  );
}

interface EditableReadoutProps {
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => ReactNode;
  onCommit: (next: number) => void;
}

/**
 * Readout that swaps to a number input on click, commits on Enter/blur,
 * cancels on Escape. Clicks are stopped so the wrapping <label> doesn't
 * forward focus to the slider thumb.
 */
function EditableReadout({ value, min, max, step, format, onCommit }: EditableReadoutProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!editing) {
    return (
      <button
        type="button"
        className="lk-property-row__readout-button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          setDraft(formatNumber(value));
          setEditing(true);
        }}
      >
        {format ? format(value) : formatNumber(value)}
      </button>
    );
  }

  const commit = () => {
    const n = parseSignedNumber(draft);
    if (Number.isFinite(n)) {
      const clamped = Math.min(max, Math.max(min, n));
      onCommit(clamped);
    }
    setEditing(false);
  };

  return (
    <input
      autoFocus
      type="text"
      inputMode="decimal"
      className="lk-property-row__readout-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/-/g, '−'))}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setEditing(false);
        }
      }}
    />
  );
}

export interface ColorRowProps {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
}

export function ColorRow({ label, value, onChange }: ColorRowProps) {
  return (
    <PropertyRow label={label} variant="color">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </PropertyRow>
  );
}

export interface CheckboxRowProps {
  label: ReactNode;
  value: boolean;
  onChange: (next: boolean) => void;
}

export function CheckboxRow({ label, value, onChange }: CheckboxRowProps) {
  return (
    <PropertyRow label={label} variant="checkbox">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </PropertyRow>
  );
}

export interface TextRowProps {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
  layout?: PropertyRowLayout;
}

export function TextRow({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  layout,
}: TextRowProps) {
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

export interface SelectRowProps<T extends string> {
  label: ReactNode;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (next: T) => void;
  layout?: PropertyRowLayout;
}

export function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
  layout,
}: SelectRowProps<T>) {
  return (
    <PropertyRow label={label} layout={layout}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
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

export interface ToggleRowProps<T extends string> {
  label: ReactNode;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (next: T) => void;
  layout?: PropertyRowLayout;
}

export function ToggleRow<T extends string>({
  label,
  value,
  options,
  onChange,
  layout,
}: ToggleRowProps<T>) {
  return (
    <PropertyRow label={label} layout={layout}>
      <div className="lk-property-row__toggle" role="radiogroup">
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
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
