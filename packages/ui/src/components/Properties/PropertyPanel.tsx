import { createContext, forwardRef, type ReactNode, type Ref, useContext } from 'react';
import { Focusable } from 'react-aria-components';
import { type StanceProps, useStance } from '../stance';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import type { PropertyFieldChrome } from './PropertyField';
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
export interface PropertyPanelProps extends PropertyMetricProps, StanceProps {
  title?: ReactNode;
  /** Controls on the trailing edge of the title row — a switch, a clear
   *  button. They sit outside the heading, so they neither take its type nor
   *  join its accessible name. */
  actions?: ReactNode;
  /**
   * Lets text inside the panel be selected and copied. A panel is chrome by
   * default, so a drag across it moves a slider rather than painting a
   * selection; a `debug` panel defaults to selectable, since what it shows —
   * ids, keys, traces — is there to be copied.
   */
  selectable?: boolean;
  children: ReactNode;
  className?: string;
}

const PanelNesting = createContext(false);

/**
 * A titled panel holding property rows — the sidebar container the rest of
 * this module's components fill.
 *
 * `stance` says what kind of content it holds and `tone` which of its peers it
 * is; the theme's `--wzl-panel-*` and `--wzl-stance-*` slots decide how each looks. A stanced
 * panel's title takes the row-label recipe rather than the display title.
 */
export function PropertyPanel({
  title,
  actions,
  selectable,
  children,
  className,
  density,
  align,
  stance,
  tone,
}: PropertyPanelProps) {
  const nested = useContext(PanelNesting);
  const attrs = useStance({ stance, tone });
  const heading = title != null && <h2 className={s.panelTitle}>{title}</h2>;
  return (
    <div
      className={propertyMetricClass(s.panel, { density, align }, className)}
      {...attrs}
      data-nested={nested || undefined}
      data-selectable={(selectable ?? stance === 'debug') || undefined}
    >
      {actions != null ? (
        <div className={s.panelHeader}>
          {heading}
          <div className={s.panelActions}>{actions}</div>
        </div>
      ) : heading}
      <PanelNesting.Provider value>{children}</PanelNesting.Provider>
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
export const PropertyList = forwardRef(function PropertyList(
  { children, className, pack = 'auto-color', density, align }: PropertyListProps,
  ref: Ref<HTMLDivElement>,
) {
  const base = `${s.list}${pack === 'pairs' ? ` ${s.listPairs}` : pack === 'one-up' ? ` ${s.listOneUp}` : ''}`;
  return (
    <div ref={ref} className={propertyMetricClass(base, { density, align }, className)}>
      {children}
    </div>
  );
});

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

/** Props for `<PropertyNote>`. */
export interface PropertyNoteProps {
  children: ReactNode;
  className?: string;
}

/**
 * Muted paragraph that spans both columns of the grid — a group's help text,
 * sitting above the rows it describes rather than beside one of them.
 * `<PropertyRow description>` covers the per-row case.
 */
export function PropertyNote({ children, className }: PropertyNoteProps) {
  return <p className={className ? `${s.note} ${className}` : s.note}>{children}</p>;
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
  /**
   * What draws the row's control. `bare` (the default) is a native input the
   * row's stylesheet dresses; `framed` is a kit field bringing its own frame,
   * which the row then leaves alone — see {@link PropertyFieldChrome}.
   */
  chrome?: PropertyFieldChrome;
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
  children,
  htmlFor,
  group,
  className,
  density,
  align,
  auto,
  onAutoChange,
  chrome,
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
    [s.row, variantClass, layoutClass, span && s.span, auto && s.rowAuto, chrome === 'framed' && s.rowFramed]
      .filter(Boolean)
      .join(' '),
    { density, align },
    className,
  );
  // A stacked row reads label, readout, control down the column, so its readout
  // belongs on the label line. An inline row would put a value of changing width
  // in front of the control, which then moves under the pointer as it changes.
  const trailing = resolved === 'inline' && readout != null;
  const head = (
    <span className={s.rowLabel}>
      {onAutoChange ? (
        <AutoToggle auto={auto ?? false} label={label} onChange={onAutoChange} />
      ) : (
        label
      )}
      {description ? <PropertyRowHelp label={label} description={description} /> : null}
      {readout != null && !trailing && <em className={s.readout}>{readout}</em>}
    </span>
  );
  const tail = trailing ? <em className={`${s.readout} ${s.readoutAfter}`}>{readout}</em> : null;
  return group ? (
    <div className={cls}>
      {head}
      {children}
      {tail}
    </div>
  ) : (
    <label className={cls} htmlFor={htmlFor}>
      {head}
      {children}
      {tail}
    </label>
  );
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
}: {
  auto: boolean;
  label: ReactNode;
  onChange: (next: boolean) => void;
}) {
  const name = typeof label === 'string' ? label : 'this setting';
  const toggle = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    // The wrapping <label> would otherwise actuate the row's control.
    e.preventDefault();
    e.stopPropagation();
    onChange(!auto);
  };
  return (
    // A span, not a button: a <button> is a labelable element, so inside the
    // row's <label> it would take the row's name off the actual control.
    <span
      role="button"
      tabIndex={0}
      className={s.autoToggle}
      aria-pressed={!auto}
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
