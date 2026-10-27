import { type ReactNode, type RefObject, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type PropertyMetricProps, propertyMetricClass } from './metrics';
import { PropertyHelp } from './PropertyHelp';
import { PropertyRowContext } from './rowContext';
import s from './Properties.module.css';

/** Which control shape a row holds, which decides its intrinsic layout. */
export type PropertyRowVariant = 'default' | 'color' | 'checkbox';
/** On a row's root element, which its help finds the row's control under. */
const ROW_ATTR = 'data-property-row';

/** Whether a row's label sits above its control or beside it. */
export type PropertyRowLayout = 'block' | 'inline';

/** Props for `<PropertyRow>`. */
export interface PropertyRowProps extends PropertyMetricProps {
  label: ReactNode;
  /** Right-aligned readout shown next to the label (e.g. current value). */
  readout?: ReactNode;
  /**
   * Help text for the row, shown in a tooltip when the label is hovered or the
   * row's control has keyboard focus, and given to the control as its
   * description. The kit setting `help.icon` adds an ⓘ beside the label.
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
  /**
   * Take only the width the label and the control need, and not the whole of
   * the grid cell: the control then sits beside its label. `span` outranks it.
   */
  hug?: boolean;
  children: ReactNode;
  htmlFor?: string;
  /** The control is a group of several (a segmented toggle), not one element.
   *  The row then renders as a `<div>`: a `<label>` hands a click on its text to
   *  its first control, which in a group means selecting the first option. Each
   *  member has to carry its own name. */
  group?: boolean;
  className?: string;
  /** The row is auto: its value is not pinned and the owner computes it. The
   *  control is hidden — its box kept, so the row does not resize — and the
   *  row reads out the word instead. */
  auto?: boolean;
  /** Given, the row's label toggles `auto` when it is clicked. Omitted, the row
   *  can show an auto state but not change it.
   *
   *  The label then names that toggle, so a control passed as `children` has to
   *  carry its own accessible name — every `<PropertyField>` does. */
  onAutoChange?: (next: boolean) => void;
  /** What an auto row does with its control. `'hidden'` (the default) keeps its
   *  box and reads out the word instead; `'dimmed'` keeps drawing it, faded, for
   *  an owner that passes the value the row inherits and pins on any edit. */
  autoControl?: 'hidden' | 'dimmed';
  /** Small muted text after the label — where an inherited value comes from. */
  hint?: ReactNode;
  /** The row's value differs from a baseline of the caller's: its label is drawn in the accent color. */
  changed?: boolean;
  /** The row stands for several values that differ: its label is drawn in the warning color. Outranks `changed`. */
  mixed?: boolean;
  /** The row's control takes no input: its label is drawn as a disabled control's is. */
  disabled?: boolean;
  /** What the row reads when it is auto, whether or not it is now. Shown as the
   *  last line of the help tooltip, after the word `auto`; with no `description`
   *  the tooltip is that line alone. */
  autoValue?: ReactNode;
  /** What is wrong with the row's value — a validation message, shown under the control as an alert. The
   *  row carries `data-invalid` while it has one. */
  error?: ReactNode;
}

/** The label-plus-control frame `<PropertyField>` draws its rows in. Use it
 *  directly for a control no field kind covers. */
export function PropertyRow({
  label,
  readout,
  description,
  variant = 'default',
  layout,
  span,
  hug,
  children,
  htmlFor,
  group,
  className,
  density,
  align,
  auto,
  onAutoChange,
  autoControl = 'hidden',
  hint,
  changed = false,
  mixed = false,
  disabled = false,
  autoValue,
  error,
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
    [
      s.row,
      variantClass,
      layoutClass,
      span && s.span,
      hug && !span && s.hug,
      auto && (autoControl === 'dimmed' ? s.rowAutoInherited : s.rowAuto),
    ]
      .filter(Boolean)
      .join(' '),
    { density, align },
    className,
  );
  // A stacked row reads label, readout, control down the column, so its readout
  // belongs on the label line. An inline row would put a value of changing width
  // in front of the control, which then moves under the pointer as it changes.
  const trailing = resolved === 'inline' && readout != null;
  const rowRef = useRef<HTMLElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const multiline = useMultiline(rowRef, labelRef, resolved === 'inline');
  const own = onAutoChange ? (
    <AutoToggle auto={auto ?? false} label={label} onChange={onAutoChange} disabled={disabled} />
  ) : (
    label
  );
  // The hint flows on from the name's last word: as a flex item of its own, it went to the column's edge
  // whenever the name wrapped, since a wrapped name's box fills the line. The space lets it drop to a line of
  // its own where it does not fit beside that word.
  const name = hint != null ? (
    <span className={s.rowName}>
      {own}{' '}
      <span className={s.rowHint} data-wzl-subordinate="">{hint}</span>
    </span>
  ) : (
    own
  );
  const head = (
    <span className={s.rowLabel} ref={labelRef}>
      {description || autoValue != null ? (
        <PropertyHelp label={label} description={description} autoValue={autoValue} within={`[${ROW_ATTR}]`}>
          {name}
        </PropertyHelp>
      ) : (
        name
      )}
      {readout != null && !trailing && <em className={s.readout}>{readout}</em>}
    </span>
  );
  const scope = useMemo(() => ({ label }), [label]);
  const tail = trailing ? <em className={`${s.readout} ${s.readoutAfter}`}>{readout}</em> : null;
  const invalid = error != null && error !== false && error !== '';
  const message = invalid ? (
    <span className={s.rowError} role="alert">
      {error}
    </span>
  ) : null;
  const multi = { [ROW_ATTR]: '', ...(multiline ? { 'data-multiline': '' } : {}), ...(changed ? { 'data-changed': '' } : {}), ...(mixed ? { 'data-mixed': '' } : {}), ...(disabled ? { 'data-disabled': '' } : {}), ...(invalid ? { 'data-invalid': '' } : {}) };
  return group ? (
    <div className={cls} ref={rowRef as RefObject<HTMLDivElement>} {...multi}>
      {head}
      <PropertyRowContext.Provider value={scope}>{children}</PropertyRowContext.Provider>
      {tail}
      {message}
    </div>
  ) : (
    <label
      className={cls}
      htmlFor={htmlFor}
      ref={rowRef as RefObject<HTMLLabelElement>}
      {...multi}
    >
      {head}
      <PropertyRowContext.Provider value={scope}>{children}</PropertyRowContext.Provider>
      {tail}
      {message}
    </label>
  );
}

/**
 * Whether an inline row runs past one line — its label wraps, or a child is
 * taller than a field. CSS can name the tall controls it knows (`:has()`), but
 * not a label that wrapped at this width, so the row measures. Never set
 * without layout, so jsdom always reads single-line.
 */
function useMultiline(
  rowRef: RefObject<HTMLElement | null>,
  labelRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): boolean {
  const [multiline, setMultiline] = useState(false);
  useLayoutEffect(() => {
    const row = rowRef.current;
    const label = labelRef.current;
    if (!enabled || !row || !label || typeof ResizeObserver === 'undefined') {
      setMultiline(false);
      return;
    }
    const measure = (): void => {
      const labelStyle = getComputedStyle(label);
      const lineHeight =
        Number.parseFloat(labelStyle.lineHeight) ||
        Number.parseFloat(labelStyle.fontSize) * 1.2;
      const floor = Number.parseFloat(getComputedStyle(row).minHeight) || lineHeight;
      const labelWraps = label.getBoundingClientRect().height > lineHeight * 1.5;
      const tallChild = Array.from(row.children).some(
        (child) => child !== label && child.getBoundingClientRect().height > floor * 1.5,
      );
      setMultiline(labelWraps || tallChild);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(label);
    for (const child of Array.from(row.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [rowRef, labelRef, enabled]);
  return multiline;
}

/**
 * A row's label, doubling as the control for whether the row is auto: clicking
 * it hands the value back to whoever computes it, or takes it back.
 *
 * Pressed means pinned, to match the name — an auto row is the unpressed one.
 */
function AutoToggle({
  auto,
  label,
  onChange,
  disabled,
}: {
  auto: boolean;
  label: ReactNode;
  onChange: (next: boolean) => void;
  disabled: boolean;
}) {
  const name = typeof label === 'string' ? label : 'this setting';
  const toggle = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    // The wrapping <label> would otherwise actuate the row's control.
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) onChange(!auto);
  };
  return (
    // A span, not a button: a <button> is a labelable element, so inside the
    // row's <label> it would take the row's name off the actual control.
    <span
      role="button"
      tabIndex={disabled ? undefined : 0}
      className={s.autoToggle}
      aria-pressed={!auto}
      aria-disabled={disabled || undefined}
      aria-label={`Pin ${name}`}
      onClick={toggle}
      onKeyDown={(e) => {
        // A native button gives Enter and Space for free; a span gives neither,
        // and Space would scroll the panel.
        if (e.key === 'Enter' || e.key === ' ') toggle(e);
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {label}
    </span>
  );
}
