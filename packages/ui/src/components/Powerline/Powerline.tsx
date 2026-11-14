import {
  Children, Fragment, cloneElement, isValidElement, useCallback, useState, type CSSProperties, type ReactElement, type ReactNode,
} from 'react';
import type { BadgeSize, BadgeVariant } from '../Badge/types';
import type { EdgeCap } from '../Badge/bases/edgeProfiles';
import { PowerlineSlotContext, type PowerlineRow } from './slot';
import s from './Powerline.module.css';

/** Props for {@link Powerline}. */
export interface PowerlineProps {
  /** The segments, in order: `Badge`s, or anything that calls `usePowerlineSegment`. */
  children?: ReactNode;
  /** Left edge of the first segment. Defaults to 'flat'. */
  startCap?: EdgeCap;
  /** Default size for every segment (a segment's own `size` wins). */
  size?: BadgeSize;
  /** Default variant for every segment (a segment's own `variant` wins). */
  variant?: BadgeVariant;
  /** Protrusion depth in CSS px, passed through to every segment's base. */
  depth?: number;
  /** Visible gap between adjacent segments. Number → px; string → literal CSS length.
   *  Default: `0.2em` (scales with the row's font size). Pass `0` for flush. */
  gap?: number | string;
  className?: string;
  'aria-label'?: string;
}

/**
 * A row of chevron-linked badge segments, in the style of a shell powerline
 * prompt. Each child `Badge` draws on the powerline base: its `endCap` shapes
 * its own right edge and the next segment's left edge, so the run reads as one
 * continuous chain.
 *
 * Built for showing a path through a sequence of steps — the inspector uses
 * it to display how input routes from tool to gesture to action to target.
 */
export function Powerline({
  children,
  startCap = 'flat',
  size,
  variant,
  depth,
  gap,
  className,
  ...rest
}: PowerlineProps) {
  const [caps, setCaps] = useState<readonly EdgeCap[]>([]);
  const report = useCallback((index: number, cap: EdgeCap) => {
    setCaps((prev) => {
      if (prev[index] === cap) return prev;
      const next = prev.slice();
      next[index] = cap;
      return next;
    });
  }, []);
  const row: PowerlineRow = { caps, startCap, depth, variant, size, segmentClassName: s.segment, report };
  const cls = [s.row, className].filter(Boolean).join(' ');
  const style: CSSProperties | undefined = gap !== undefined
    ? { ['--powerline-gap' as never]: typeof gap === 'number' ? `${gap}px` : gap }
    : undefined;
  return (
    <span
      className={cls}
      style={style}
      role={rest['aria-label'] === undefined ? undefined : 'group'}
      aria-label={rest['aria-label']}
    >
      {segmentsOf(children).map((child, index) => (
        <PowerlineSlotContext.Provider key={keyOf(child, index)} value={{ index, row }}>
          {child}
        </PowerlineSlotContext.Provider>
      ))}
    </span>
  );
}

/** The row's segments: its children, with fragments opened so each badge in one is a segment of its own. */
function segmentsOf(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) =>
    isValidElement(child) && child.type === Fragment
      ? segmentsOf((child as ReactElement<{ children?: ReactNode }>).props.children)
        .map((inner) => (isValidElement(inner) ? cloneElement(inner, { key: `${child.key}/${inner.key}` }) : inner))
      : [child]);
}

function keyOf(child: ReactNode, index: number): string | number {
  return typeof child === 'object' && child !== null && 'key' in child && child.key != null ? child.key : index;
}
