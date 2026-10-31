import { useCallback, useMemo, type ReactNode, type Ref } from 'react';
import { assignRef } from '@weasel-js/react';
import type { MenuEntry } from '@weasel-js/menu';
import { type OverlayPortalProps } from '../../overlays/portalHost';
import { Caret } from '../Caret';
import { useMenuTrigger } from '../ContextMenu/useMenuTrigger';
import f from '../field.module.css';
import s from './MenuButton.module.css';
import { SegmentTooltip, segmentTooltipContent, type SegmentTooltipFields } from '../segmentTooltip';

/** One row in a {@link MenuButton}'s list. */
export type MenuButtonItem<T extends string = string> = {
  value: T;
  label: string;
  isDisabled?: boolean;
  /** Makes the row a link: an `<a>` that goes here when chosen, and that a
   *  middle or modified click opens as it opens any link. */
  href?: string;
  /** The row for the page that is open: `aria-current="page"`, drawn bold. */
  isCurrent?: boolean;
  /** Makes the row a check row, ticked while true. */
  checked?: boolean;
};

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
  /** Receives the trigger `<button>`, to move focus to it. */
  buttonRef?: Ref<HTMLButtonElement>;
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
  buttonRef,
}: MenuButtonProps<T>) {
  const trigger = useMenuTrigger(portalContainer);
  const triggerButton = trigger.button;
  const setButton = useCallback(
    (el: HTMLButtonElement | null) => {
      triggerButton.current = el;
      assignRef(buttonRef, el);
    },
    [triggerButton, buttonRef],
  );
  const entries = useMemo(
    (): MenuEntry[] => items.map((item) => ({
      kind: 'item',
      key: item.value,
      label: item.label,
      ...(item.isDisabled ? { disabled: true } : {}),
      ...(item.href !== undefined ? { href: item.href } : {}),
      ...(item.isCurrent ? { current: true } : {}),
      ...(item.checked !== undefined ? { checked: item.checked } : {}),
      run: () => onAction?.(item.value),
    })),
    [items, onAction],
  );
  return (
    <>
      {trigger.anchor}
      <SegmentTooltip
        content={segmentTooltipContent({ tooltip, shortcut, ariaLabel, label })}
        disabled={isDisabled}
      >
        <button
          ref={setButton}
          id={trigger.id}
          type="button"
          className={[bare ? s.bare : f.frame, s.trigger, className].filter(Boolean).join(' ')}
          disabled={isDisabled}
          {...(isDisabled ? { 'data-disabled': '' } : {})}
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={trigger.open}
          onPointerDown={trigger.press}
          onClick={(e) => trigger.click(e, () => entries)}
          {...(current ? { 'data-current': '' } : {})}
        >
          <span className={s.label}>{label}</span>
          <Caret className={s.chevron} />
        </button>
      </SegmentTooltip>
      {trigger.portal}
    </>
  );
}
