import type { FocusEvent, HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import s from './Badge.module.css';
import { Focusable, Tooltip, TooltipTrigger } from '../Tooltip';

/** The × that removes a badge. A sibling of the label, never inside a click target. */
export function BadgeRemove({ label = 'Remove', onRemove }: { label?: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      className={s.remove}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
    >
      <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false">
        <path d="M 2 2 L 8 8 M 8 2 L 2 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </svg>
    </button>
  );
}

interface BadgeTargetProps {
  /** What the badge would have been at its root: a button, a link, or a plain tooltip trigger. */
  element: 'span' | 'button' | 'a';
  href?: string;
  onClick?: () => void;
  'aria-label'?: string;
  tooltip?: ReactNode;
  onFocusChange: (focused: boolean) => void;
  /** Attributes the badge's caller puts on the label; its own handlers run after these. */
  extra?: HTMLAttributes<HTMLElement>;
  children: ReactNode;
}

/**
 * A removable badge's label, carrying the action the badge's root would carry
 * if it could: a root `<button>` or `<a>` may not hold the remove button.
 */
export function BadgeTarget(props: BadgeTargetProps) {
  const { element, href, onClick, tooltip, onFocusChange, extra, children } = props;
  const shared = {
    ...extra,
    className: s.target,
    'aria-label': props['aria-label'],
    onFocus: (e: FocusEvent<HTMLElement>) => { extra?.onFocus?.(e); onFocusChange(true); },
    onBlur: (e: FocusEvent<HTMLElement>) => { extra?.onBlur?.(e); onFocusChange(false); },
  };
  const onOwnKey = (key: string, act: (e: KeyboardEvent) => void) => (e: KeyboardEvent) => {
    if (e.key === key && e.target === e.currentTarget) act(e);
  };
  let target;
  if (element === 'a') {
    target = <a {...shared} href={href} onClick={onClick}>{children}</a>;
  } else if (element === 'button') {
    target = (
      <span
        {...shared}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          extra?.onKeyDown?.(e);
          if (e.defaultPrevented) return;
          onOwnKey('Enter', () => onClick?.())(e);
          // Space acts on release, as a native button does; held, it must not scroll the page.
          onOwnKey(' ', (ev) => ev.preventDefault())(e);
        }}
        onKeyUp={onOwnKey(' ', () => onClick?.())}
      >
        {children}
      </span>
    );
  } else {
    target = <span {...shared} role="img">{children}</span>;
  }
  if (tooltip == null) return target;
  return (
    <TooltipTrigger>
      <Focusable>{target}</Focusable>
      <Tooltip>{tooltip}</Tooltip>
    </TooltipTrigger>
  );
}
