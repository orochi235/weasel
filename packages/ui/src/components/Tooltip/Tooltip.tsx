import type { ReactNode } from 'react';
import {
  TooltipTrigger as RACTooltipTrigger,
  Tooltip as RACTooltip,
  OverlayArrow,
  type TooltipProps as RACTooltipProps,
  type TooltipTriggerComponentProps,
} from 'react-aria-components';
import s from './Tooltip.module.css';

/**
 * Props for {@link TooltipTrigger} — React Aria's `TooltipTrigger` props
 * unchanged.
 */
export type TooltipTriggerProps = TooltipTriggerComponentProps;

/**
 * TooltipTrigger with kit defaults: ~600 ms open delay, instant close.
 * Wrap a focusable trigger plus a `<Tooltip>`. Non-RAC triggers (plain
 * `<button>` etc.) must be wrapped in `<Focusable>` from
 * react-aria-components so hover/focus props reach the DOM node.
 *
 * Caveat: while a tooltip is open, react-aria captures the first Escape
 * keydown (document-level, capture phase) to dismiss it — app-level
 * Escape handlers (deselect, cancel gesture) see only the second press.
 */
export function TooltipTrigger(props: TooltipTriggerProps) {
  const { delay = 600, closeDelay = 0, ...rest } = props;
  return <RACTooltipTrigger delay={delay} closeDelay={closeDelay} {...rest} />;
}

/** Props for {@link Tooltip}, on top of React Aria's `Tooltip` props. */
export type TooltipProps = Omit<RACTooltipProps, 'children' | 'className'> & {
  children?: ReactNode;
  className?: string;
};

/**
 * Tooltip bubble with an arrow pointing at the trigger. Non-interactive
 * content only (ARIA tooltip semantics). Use inside `<TooltipTrigger>`.
 */
export function Tooltip(props: TooltipProps) {
  const { children, className, placement = 'top', offset = 8, ...rest } = props;
  return (
    <RACTooltip
      {...rest}
      placement={placement}
      offset={offset}
      className={[s.tooltip, className].filter(Boolean).join(' ')}
    >
      <OverlayArrow className={s.arrow}>
        <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden="true">
          <path d="M0 0 L4 4 L8 0" />
        </svg>
      </OverlayArrow>
      {children}
    </RACTooltip>
  );
}
