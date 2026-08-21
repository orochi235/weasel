import type { CSSProperties, ReactNode } from 'react';
import { Badge } from '../Badge/Badge';
import type { BadgeSize, BadgeTone, BadgeVariant } from '../Badge/types';
import type { EdgeCap } from '../Badge/bases/edgeProfiles';
import s from './Powerline.module.css';

/**
 * One segment of a {@link Powerline}. Giving it `onClick` or `href` makes it
 * interactive, the same way it does on a `Badge`.
 */
export interface PowerlineSegment {
  text: ReactNode;
  /** Cap on this segment's right edge. Next segment's left edge adopts the same profile. */
  endCap?: EdgeCap;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  onClick?: () => void;
  href?: string;
  'aria-label'?: string;
}

/** Props for {@link Powerline}. */
export interface PowerlineProps {
  segments: PowerlineSegment[];
  /** Left edge of the first segment. Defaults to 'flat'. */
  startCap?: EdgeCap;
  /** Default size for every segment (per-segment `size` wins). */
  size?: BadgeSize;
  /** Default variant for every segment (per-segment `variant` wins). */
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
 * prompt. Each segment's `endCap` shapes both its own right edge and the next
 * segment's left edge, so the run reads as one continuous chain.
 *
 * Built for showing a path through a sequence of steps — the inspector uses
 * it to display how input routes from tool to gesture to action to target.
 */
export function Powerline({
  segments,
  startCap = 'flat',
  size,
  variant,
  depth,
  gap,
  className,
  ...rest
}: PowerlineProps) {
  const cls = [s.row, className].filter(Boolean).join(' ');
  const style: CSSProperties | undefined = gap !== undefined
    ? { ['--powerline-gap' as never]: typeof gap === 'number' ? `${gap}px` : gap }
    : undefined;
  return (
    <span className={cls} style={style} aria-label={rest['aria-label']}>
      {segments.map((seg, i) => {
        const leftEdge: EdgeCap = i === 0 ? startCap : (segments[i - 1].endCap ?? 'flat');
        const rightEdge: EdgeCap = seg.endCap ?? 'flat';
        return (
          <Badge
            key={i}
            base="powerline"
            baseParams={{ leftEdge, rightEdge, ...(depth !== undefined && { depth }) }}
            tone={seg.tone}
            variant={seg.variant ?? variant}
            size={seg.size ?? size}
            onClick={seg.onClick}
            href={seg.href}
            aria-label={seg['aria-label']}
            className={s.segment}
          >
            {seg.text}
          </Badge>
        );
      })}
    </span>
  );
}
