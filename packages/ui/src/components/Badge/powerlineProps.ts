import { usePowerlineSegment } from '../Powerline/slot';
import type { BadgeProps } from './Badge';

/**
 * A badge's props as it draws them: inside a `Powerline`, a badge with no `base` of its own takes the
 * powerline base, its left edge from the segment before it and its right from its own `endCap`, and the
 * row's variant and size wherever it sets none.
 */
export function usePowerlineProps({ endCap, ...props }: BadgeProps): BadgeProps {
  const seg = usePowerlineSegment(endCap);
  if (!seg || props.base !== undefined) return props as BadgeProps;
  return {
    ...props,
    base: 'powerline',
    baseParams: { leftEdge: seg.leftEdge, rightEdge: seg.rightEdge, ...(seg.depth !== undefined && { depth: seg.depth }) },
    variant: props.variant ?? seg.variant,
    size: props.size ?? seg.size,
    className: [seg.className, props.className].filter(Boolean).join(' '),
  } as BadgeProps;
}
