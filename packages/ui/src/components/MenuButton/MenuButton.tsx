import type { ReactNode } from 'react';
import {
  Button as RACButton,
  Menu as RACMenu,
  MenuItem as RACMenuItem,
  MenuTrigger,
  Popover as RACPopover,
} from 'react-aria-components';
import { useOverlayPortal, type OverlayPortalProps } from '../../overlays/portalHost';
import { Caret } from '../Caret';
import f from '../field.module.css';
import listbox from '../listbox.module.css';
import s from './MenuButton.module.css';
import { TriggerTooltip, segmentTooltipContent, type SegmentTooltipFields } from '../segmentTooltip';

/** One row in a {@link MenuButton}'s list. */
export type MenuButtonItem<T extends string = string> = {
  value: T;
  label: ReactNode;
  isDisabled?: boolean;
  /** Plain-text form of `label`, for type-to-select and screen readers. A
   *  string label supplies this itself. */
  textValue?: string;
  /** Makes the row a link: an `<a>` that goes here when chosen, and that a
   *  middle or modified click opens as it opens any link. */
  href?: string;
  /** The row for the page that is open: `aria-current="page"`, drawn bold. */
  isCurrent?: boolean;
};

/** React Aria passes a menu item no ARIA attribute it does not write itself. */
const markCurrent = (el: HTMLElement | null) => el?.setAttribute('aria-current', 'page');
const unmarkCurrent = (el: HTMLElement | null) => el?.removeAttribute('aria-current');

/** Props for {@link MenuButton}. */
export type MenuButtonProps<T extends string = string> = {
  /** What the button says. It never changes to show a chosen row. */
  label: ReactNode;
  /** The label is a value the caller holds and has set from the last row
   *  chosen, so it reads as a value and not as a prompt. */
  current?: boolean;
  items: ReadonlyArray<MenuButtonItem<T>>;
  /** Fired with the value of the row chosen. A menu of links can go without. */
  onAction?: (value: T) => void;
  /** Draws the trigger as its label and a caret in the type around it, with
   *  no field frame: for a heading that opens a list. */
  bare?: boolean;
  isDisabled?: boolean;
  className?: string;
  'aria-label'?: string;
} & SegmentTooltipFields & OverlayPortalProps;

/**
 * A button that opens a list and acts on the row chosen — "Add trial…",
 * "Load…". Unlike a {@link Select} it holds no value, so it sizes to its own
 * label rather than to its widest row. A row with an `href` is a link, so
 * the same list serves as a way between pages.
 *
 * `shortcut` adds a kit tooltip reading `Name (⌘N)`, named by `aria-label` or
 * a string `label`, as `Button` does; `tooltip` replaces that text.
 */
export function MenuButton<T extends string = string>({
  label,
  current,
  items,
  onAction,
  isDisabled,
  bare,
  className,
  'aria-label': ariaLabel,
  portalContainer,
  shortcut,
  tooltip,
}: MenuButtonProps<T>) {
  const { anchor, portalProps, ready } = useOverlayPortal(portalContainer);
  return (
    <MenuTrigger>
      {anchor}
      <TriggerTooltip
        content={segmentTooltipContent({ tooltip, shortcut, ariaLabel, label })}
        disabled={isDisabled}
      >
        <RACButton
          className={[bare ? s.bare : f.frame, s.trigger, className].filter(Boolean).join(' ')}
          isDisabled={isDisabled}
          aria-label={ariaLabel}
          {...(current ? { 'data-current': '' } : {})}
        >
          <span className={s.label}>{label}</span>
          <Caret className={s.chevron} />
        </RACButton>
      </TriggerTooltip>
      {/* `data-weasel-overlay`: see Select — the list renders in a portal,
          outside the subtree the trigger sits in. */}
      {ready && (
        <RACPopover className={s.popover} data-weasel-overlay="" {...portalProps}>
          <RACMenu className={`${listbox.surface} ${listbox.list}`} onAction={(key) => onAction?.(key as T)}>
            {items.map((item) => (
              <RACMenuItem
                key={item.value}
                id={item.value}
                className={s.item}
                href={item.href}
                ref={item.isCurrent ? markCurrent : unmarkCurrent}
                isDisabled={item.isDisabled}
                textValue={item.textValue ?? (typeof item.label === 'string' ? item.label : undefined)}
              >
                {item.label}
              </RACMenuItem>
            ))}
          </RACMenu>
        </RACPopover>
      )}
    </MenuTrigger>
  );
}
