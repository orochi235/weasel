import s from './Properties.module.css';

/**
 * How much room a container gives its rows — gaps, padding, and field height,
 * moved together. Set on any container in the family; it reaches every
 * descendant, so an inner group can differ from the panel around it.
 */
export type PropertySpacing = 'tight' | 'normal' | 'loose';

/** Where an inline row's label and control sit on the row's cross axis. Set on
 *  a container to line a whole column of them up. */
export type PropertyAlign = 'start' | 'center' | 'end' | 'baseline';

/** Metric props every container in the family takes. Both reach descendants,
 *  so the nearest container that states one wins. */
export interface PropertyMetricProps {
  /** Room the rows get. Unset inherits from an outer container, else `normal`. */
  spacing?: PropertySpacing;
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

const SPACING_CLASS: Record<PropertySpacing, string> = {
  tight: s.spacingTight,
  normal: s.spacingNormal,
  loose: s.spacingLoose,
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
  { spacing, align }: PropertyMetricProps,
  className?: string,
): string {
  return [base, spacing && SPACING_CLASS[spacing], align && ALIGN_CLASS[align], className]
    .filter(Boolean)
    .join(' ');
}
