import { cloneElement, type DOMAttributes, type ReactElement, type ReactNode, type SyntheticEvent } from 'react';
import { controlAccess, NO_HOLD, type ControlAccess } from '@weasel-js/ui-logic';
import { Focusable } from './Focusable';
import { Tooltip, TooltipTrigger } from './Tooltip';
import { useDisabled, useReadOnly, type HoldProps } from '../Disabled';
import { useUntoldReason } from '../Disabled/Disabled';

/** The tooltip fields a button, a segment, or a select carries. */
export interface TooltipFields {
  /** Tooltip content. Overrides the name-plus-`shortcut` default. */
  tooltip?: ReactNode;
  /** Shortcut hint shown in the tooltip as `Name (⌘Z)`, the way `ActionButton`
   *  shows its own. The name is `ariaLabel`, else a string `label`. */
  shortcut?: string;
}

/** What a button's tooltip is built from. */
export interface TooltipParts extends TooltipFields {
  label?: ReactNode;
  ariaLabel?: string;
  /** What the tooltip reads in place of the name, before the shortcut. */
  description?: string;
}

/** Tooltip content for an item, or `undefined` for none. An item held for a `reason` (disabled or read-only) reads
 *  its name and the reason. */
export function tooltipContent(item: TooltipParts & { reason?: string }): ReactNode | undefined {
  const name = item.description || (item.ariaLabel ?? (typeof item.label === 'string' ? item.label : undefined));
  if (item.reason) return name ? `${name}: ${item.reason}` : item.reason;
  if (item.tooltip !== undefined) return item.tooltip;
  if (!item.shortcut) return item.description || undefined;
  return name ? `${name} (${item.shortcut})` : item.shortcut;
}

type ButtonElement = ReactElement<DOMAttributes<HTMLButtonElement> & { disabled?: boolean }, 'button'>;

const refuse = (e: SyntheticEvent) => e.preventDefault();

/** `button` held by `aria-disabled` or `data-readonly`, since native `disabled` takes it out of hover and focus and
 *  so out of its tooltip's reach. Stylesheets dim `data-disabled`. */
function stillReachable(button: ButtonElement, access: ControlAccess): ButtonElement {
  return cloneElement(button as ReactElement<Record<string, unknown>>, {
    disabled: false,
    ...(access.state === 'disabled' ? { 'aria-disabled': true, 'data-disabled': '' } : { 'data-readonly': '' }),
    'aria-description': access.reason,
    onClick: refuse,
    onPointerDown: undefined,
    onMouseDown: undefined,
  }) as ButtonElement;
}

/** Props for {@link ButtonTooltip}. */
export interface ButtonTooltipProps extends HoldProps {
  /** What the tooltip says, while the button is not held for a reason. */
  tip: TooltipParts;
  /** It shows a value, so a read-only scope holds it: a toggle, not an action button. */
  holdsValue?: boolean;
  children: ButtonElement;
}

/** How a button responds, from its own props and the scopes around it. */
export function useButtonAccess({ holdsValue = false, ...own }: HoldProps & { holdsValue?: boolean }): ControlAccess {
  const disabled = useDisabled(own);
  const readOnly = useReadOnly(own);
  return controlAccess(
    { on: disabled.disabled, reason: disabled.reason },
    holdsValue ? { on: readOnly.readOnly, reason: readOnly.reason } : NO_HOLD,
  );
}

/** Wraps a `<button>` in a kit tooltip when there is content for one, and applies its disabled and
 *  read-only state, its own or a scope's. Disabled with no reason, the button is natively disabled and has no
 *  tooltip. Held for a reason, it stays hoverable and focusable, marked `aria-disabled` (or `data-readonly`),
 *  ignores presses, and its tooltip and description say why. */
export function ButtonTooltip({ tip, children, ...own }: ButtonTooltipProps): ReactElement {
  const held = useButtonAccess(own);
  const access = { ...held, reason: useUntoldReason(held.reason) };
  const content = tooltipContent({ ...tip, reason: access.reason });
  const off = !access.reachable;
  const button = off ? (cloneElement(children, { disabled: true }) as ButtonElement)
    : access.state === 'enabled' ? children : stillReachable(children, access);
  if (content === undefined || content === null || content === false) return button;
  // The same wrappers whatever the state, so a button that becomes disabled is not remounted.
  return (
    <TooltipTrigger isDisabled={off}>
      <Focusable isDisabled={off}>{button}</Focusable>
      <Tooltip>{content}</Tooltip>
    </TooltipTrigger>
  );
}

/** {@link ButtonTooltip} for a React Aria trigger (`Button` inside a
 *  `MenuTrigger` or `Select`), which takes the tooltip's hover and focus props
 *  itself and so needs no `Focusable` around it. */
export function TriggerTooltip({ content, disabled, children }: {
  content: ReactNode | undefined;
  disabled?: boolean;
  children: ReactElement;
}): ReactElement {
  if (content === undefined || content === null || content === false) return children;
  return (
    <TooltipTrigger isDisabled={disabled}>
      {children}
      <Tooltip>{content}</Tooltip>
    </TooltipTrigger>
  );
}
