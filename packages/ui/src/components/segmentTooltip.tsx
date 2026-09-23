import type { DOMAttributes, ReactElement, ReactNode } from 'react';
import { Focusable } from 'react-aria-components';
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

/** Tooltip content for an item, or `undefined` for none. */
export function segmentTooltipContent(
  item: SegmentTooltipFields & { label?: ReactNode; ariaLabel?: string },
): ReactNode | undefined {
  if (item.tooltip !== undefined) return item.tooltip;
  if (!item.shortcut) return undefined;
  const name = item.ariaLabel ?? (typeof item.label === 'string' ? item.label : undefined);
  return name ? `${name} (${item.shortcut})` : item.shortcut;
}

/** Wraps a segment's `<button>` in a kit tooltip when there is content for one. */
export function SegmentTooltip({ content, disabled, children }: {
  content: ReactNode | undefined;
  disabled?: boolean;
  children: ReactElement<DOMAttributes<HTMLButtonElement>, 'button'>;
}): ReactElement {
  if (content === undefined || content === null || content === false) return children;
  return (
    <TooltipTrigger isDisabled={disabled}>
      <Focusable isDisabled={disabled}>{children}</Focusable>
      <Tooltip>{content}</Tooltip>
    </TooltipTrigger>
  );
}
