import { useCallback, useMemo, type ReactNode, type Ref } from 'react';
import { assignRef } from '@weasel-js/react';
import type { MenuEntry } from '@weasel-js/menu';
import { type OverlayPortalProps } from '../../overlays/portalHost';
import { Caret } from '../Caret';
import { useMenuTrigger } from '../Menu/useMenuTrigger';
import f from '../field.module.css';
import s from './MenuButton.module.css';
import { ButtonTooltip, type TooltipFields } from '../Tooltip/buttonTooltip';
import { useDisabled, type DisableableProps } from '../Disabled';
import type { ListOption } from '../listOption';

/** One row in a {@link MenuButton}'s list: a {@link ListOption} whose label is text, since a row is named and typed
 *  against its label, and which draws no glyph. */
export type MenuButtonItem<T extends string = string> = Omit<ListOption<T>, 'label' | 'icon' | 'textValue'> & {
  label: string;
  /** Makes the row a link: an `<a>` that goes here when chosen, and that a
   *  middle or modified click opens as it opens any link. */
  href?: string;
  /** The row for the page that is open: `aria-current="page"`, drawn bold. */
  current?: boolean;
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
  /** Fired with the value of the row chosen. A menu of links can go without. */
  onAction?: (value: T) => void;
  /** Draws the trigger as its label and a caret in the type around it, with
   *  no field frame: for a heading that opens a list. */
  bare?: boolean;
  className?: string;
  'aria-label'?: string;
  /** Receives the trigger `<button>`, to move focus to it. */
  buttonRef?: Ref<HTMLButtonElement>;
} & MenuButtonRows<T> & TooltipFields & OverlayPortalProps & DisableableProps;

/** A {@link MenuButton}'s list: flat `items` it acts on through `onAction`, or `entries` in `@weasel-js/menu`'s
 *  model, which run themselves and can hold separators, submenus and value rows. Given both, `entries` is drawn. A
 *  function is called each time the menu opens, so it lists what holds then. */
export interface MenuButtonRows<T extends string = string> {
  items?: ReadonlyArray<MenuButtonItem<T>>;
  entries?: ReadonlyArray<MenuEntry> | (() => ReadonlyArray<MenuEntry>);
}

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
  entries,
  onAction,
  disabled,
  bare,
  className,
  'aria-label': ariaLabel,
  portalContainer,
  shortcut,
  tooltip,
  disabledReason,
  buttonRef,
}: MenuButtonProps<T>) {
  const off = useDisabled({ disabled, disabledReason }).disabled;
  const trigger = useMenuTrigger(portalContainer);
  const triggerButtonRef = trigger.button;
  const setButton = useCallback(
    (el: HTMLButtonElement | null) => {
      triggerButtonRef.current = el;
      assignRef(buttonRef, el);
    },
    [triggerButtonRef, buttonRef],
  );
  const fromItems = useMemo(
    (): MenuEntry[] | null => items ? items.map((item) => ({
      kind: 'item',
      key: item.value,
      label: item.label,
      ...(item.disabled ? { disabled: true } : {}),
      ...(item.disabled && item.disabledReason !== undefined ? { disabledReason: item.disabledReason } : {}),
      ...(item.description !== undefined ? { description: item.description } : {}),
      ...(item.href !== undefined ? { href: item.href } : {}),
      ...(item.current ? { current: true } : {}),
      ...(item.checked !== undefined ? { checked: item.checked } : {}),
      run: () => onAction?.(item.value),
    })) : null,
    [items, onAction],
  );
  const build = (): ReadonlyArray<MenuEntry> =>
    typeof entries === 'function' ? entries() : entries ?? fromItems ?? [];
  return (
    <>
      {trigger.anchor}
      <ButtonTooltip
        tip={{ tooltip, shortcut, ariaLabel, label }}
        disabled={disabled}
        disabledReason={disabledReason}
      >
        <button
          ref={setButton}
          id={trigger.id}
          type="button"
          className={[bare ? s.bare : f.frame, s.trigger, className].filter(Boolean).join(' ')}
          disabled={off}
          {...(off ? { 'data-disabled': '' } : {})}
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={trigger.open}
          onPointerDown={trigger.press}
          onClick={(e) => trigger.click(e, build)}
          {...(current ? { 'data-current': '' } : {})}
        >
          <span className={s.label}>{label}</span>
          <Caret className={s.chevron} />
        </button>
      </ButtonTooltip>
      {trigger.portal}
    </>
  );
}
