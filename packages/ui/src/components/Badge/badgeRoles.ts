import type { ReactNode } from 'react';

/** Which element a badge's root is, whether its label splits off to take the action, and its accessible name. */
export interface BadgeRoles {
  element: 'span' | 'button' | 'a';
  /** A tooltip on a badge that is neither a button nor a link, so the root joins the tab order as `role="img"`. */
  tooltipOnPlainBadge: boolean;
  /** The root is a `<span>` and the label inside it takes the action, the tooltip and the name. */
  split: boolean;
  ariaLabel: string | undefined;
}

interface RoleInputs {
  as?: 'span' | 'button' | 'a';
  href?: string;
  onClick?: () => void;
  onRemove?: () => void;
  tooltip?: ReactNode;
  children: ReactNode;
  'aria-label'?: string;
}

function chooseElement(props: RoleInputs): 'span' | 'button' | 'a' {
  if (props.as) return props.as;
  if (props.href) return 'a';
  if (props.onClick) return 'button';
  return 'span';
}

export function badgeRoles(props: RoleInputs): BadgeRoles {
  const { onRemove, tooltip, children } = props;
  const element = chooseElement(props);
  const tooltipOnPlainBadge = tooltip != null && element === 'span';
  const split = onRemove != null && (element !== 'span' || tooltip != null);
  const ariaLabel = props['aria-label']
    ?? (tooltipOnPlainBadge && (typeof children === 'string' || typeof children === 'number') ? String(children) : undefined);
  return { element, tooltipOnPlainBadge, split, ariaLabel };
}
