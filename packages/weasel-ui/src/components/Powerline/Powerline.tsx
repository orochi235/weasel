import type { ReactNode } from 'react';
import { Badge } from '../Badge/Badge';
import type { BadgeSize, BadgeTone, BadgeVariant } from '../Badge/types';
import type { EdgeCap } from '../Badge/bases/edgeProfiles';
import s from './Powerline.module.css';

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
  className?: string;
  'aria-label'?: string;
}

export function Powerline({
  segments,
  startCap = 'flat',
  size,
  variant,
  depth,
  className,
  ...rest
}: PowerlineProps) {
  const cls = [s.row, className].filter(Boolean).join(' ');
  return (
    <span className={cls} aria-label={rest['aria-label']}>
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
          >
            {seg.text}
          </Badge>
        );
      })}
    </span>
  );
}
