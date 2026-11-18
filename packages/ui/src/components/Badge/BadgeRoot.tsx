import type { ReactNode, Ref } from 'react';
import { Focusable, Tooltip, TooltipTrigger } from '../Tooltip';

interface BadgeRootProps {
  element: 'span' | 'button' | 'a';
  split: boolean;
  /** Everything the root element carries but its ref and its action. */
  rootProps: object;
  rootRef: Ref<HTMLElement>;
  href?: string;
  onClick?: () => void;
  tooltip?: ReactNode;
  children: ReactNode;
}

/** A badge's root element, a `<span>`, `<button>` or `<a>`, and the tooltip trigger around it when it has one. */
export function BadgeRoot({ element, split, rootProps, rootRef, href, onClick, tooltip, children }: BadgeRootProps) {
  if (split) return <span {...rootProps} ref={rootRef}>{children}</span>;
  let badge;
  if (element === 'button') {
    badge = (
      <button type="button" {...rootProps} ref={rootRef as Ref<HTMLButtonElement>} onClick={onClick}>
        {children}
      </button>
    );
  } else if (element === 'a') {
    badge = (
      <a href={href} {...rootProps} ref={rootRef as Ref<HTMLAnchorElement>} onClick={onClick}>
        {children}
      </a>
    );
  } else {
    badge = <span {...rootProps} ref={rootRef}>{children}</span>;
  }
  if (tooltip == null) return badge;
  return (
    <TooltipTrigger>
      <Focusable>{badge}</Focusable>
      <Tooltip>{tooltip}</Tooltip>
    </TooltipTrigger>
  );
}
