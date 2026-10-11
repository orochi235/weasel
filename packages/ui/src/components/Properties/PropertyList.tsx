import { forwardRef, type ReactNode, type Ref } from 'react';
import { type PropertyMetricProps, propertyMetricClass } from './metrics';
import s from './Properties.module.css';

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
