import { cloneElement, type DOMAttributes, type ReactElement, type ReactNode, type SyntheticEvent } from 'react';
import { Focusable } from './Tooltip/Focusable';
import { Tooltip, TooltipTrigger } from './Tooltip';

/** The tooltip fields a segmented bar's item carries. */
export interface SegmentTooltipFields {
  /** Tooltip content. Overrides the name-plus-`shortcut` default. */
  tooltip?: ReactNode;
  /** Shortcut hint shown in the tooltip as `Name (⌘Z)`, the way `ToolButton`
   *  and `ActionBar` show theirs. The name is `ariaLabel`, else a string
   *  `label`. */
  shortcut?: string;
}

/** Tooltip content for an item, or `undefined` for none. A disabled item with
 *  a `disabledReason` reads its name and the reason. */
export function segmentTooltipContent(
  item: SegmentTooltipFields & {
    label?: ReactNode;
    ariaLabel?: string;
    /** What the tooltip reads in place of the name, before the shortcut. */
    description?: string;
    disabled?: boolean;
    disabledReason?: string;
  },
): ReactNode | undefined {
  const name = item.description || (item.ariaLabel ?? (typeof item.label === 'string' ? item.label : undefined));
  if (item.disabled && item.disabledReason) return name ? `${name}: ${item.disabledReason}` : item.disabledReason;
  if (item.tooltip !== undefined) return item.tooltip;
  if (!item.shortcut) return item.description || undefined;
  return name ? `${name} (${item.shortcut})` : item.shortcut;
}

type ButtonElement = ReactElement<DOMAttributes<HTMLButtonElement> & { disabled?: boolean }, 'button'>;

const refuse = (e: SyntheticEvent) => e.preventDefault();

/** `button` disabled by `aria-disabled`, since native `disabled` takes it out of hover and focus and so out of its
 *  tooltip's reach. Stylesheets dim `data-disabled`: `ToolButton`'s `ariaDisabled` sets `aria-disabled` undimmed. */
function stillReachable(button: ButtonElement, reason: string | undefined): ButtonElement {
  return cloneElement(button as ReactElement<Record<string, unknown>>, {
    disabled: false,
    'aria-disabled': true,
    'data-disabled': '',
    ...(reason ? { 'aria-description': reason } : {}),
    onClick: refuse,
    onPointerDown: undefined,
    onMouseDown: undefined,
  }) as ButtonElement;
}

/** Wraps a segment's `<button>` in a kit tooltip when there is content for
 *  one. A disabled button with a tooltip keeps it: it stays hoverable and
 *  focusable, marked `aria-disabled`, and ignores presses. */
export function SegmentTooltip({ content, disabled, disabledReason, children }: {
  content: ReactNode | undefined;
  disabled?: boolean;
  /** Read as the button's description while it is disabled. */
  disabledReason?: string;
  children: ButtonElement;
}): ReactElement {
  if (content === undefined || content === null || content === false) return children;
  return (
    <TooltipTrigger>
      <Focusable>{disabled ? stillReachable(children, disabledReason) : children}</Focusable>
      <Tooltip>{content}</Tooltip>
    </TooltipTrigger>
  );
}

/** {@link SegmentTooltip} for a React Aria trigger (`Button` inside a
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
