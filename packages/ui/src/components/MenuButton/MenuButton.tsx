import type { ReactNode } from 'react';
import {
  Button as RACButton,
  Menu as RACMenu,
  MenuItem as RACMenuItem,
  MenuTrigger,
  Popover as RACPopover,
} from 'react-aria-components';
import { useOverlayPortal, type OverlayPortalProps } from '../../overlays/portalHost';
import s from './MenuButton.module.css';

/** One row in a {@link MenuButton}'s list. */
export type MenuButtonItem<T extends string = string> = {
  value: T;
  label: ReactNode;
  isDisabled?: boolean;
  /** Plain-text form of `label`, for type-to-select and screen readers. A
   *  string label supplies this itself. */
  textValue?: string;
};

/** Props for {@link MenuButton}. */
export type MenuButtonProps<T extends string = string> = {
  /** What the button says. It never changes to show a chosen row. */
  label: ReactNode;
  items: ReadonlyArray<MenuButtonItem<T>>;
  /** Fired with the value of the row chosen. */
  onAction: (value: T) => void;
  isDisabled?: boolean;
  className?: string;
  'aria-label'?: string;
} & OverlayPortalProps;

/**
 * A button that opens a list and acts on the row chosen — "Add trial…",
 * "Load…". Unlike a {@link Select} it holds no value, so it sizes to its own
 * label rather than to its widest row.
 */
export function MenuButton<T extends string = string>({
  label,
  items,
  onAction,
  isDisabled,
  className,
  'aria-label': ariaLabel,
  portalContainer,
}: MenuButtonProps<T>) {
  const { anchor, portalProps } = useOverlayPortal(portalContainer);
  return (
    <MenuTrigger>
      {anchor}
      <RACButton
        className={[s.trigger, className].filter(Boolean).join(' ')}
        isDisabled={isDisabled}
        aria-label={ariaLabel}
      >
        <span className={s.label}>{label}</span>
        <svg className={s.chevron} viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </RACButton>
      {/* `data-weasel-overlay`: see Select — the list renders in a portal,
          outside the subtree the trigger sits in. */}
      <RACPopover className={s.popover} data-weasel-overlay="" {...portalProps}>
        <RACMenu className={s.menu} onAction={(key) => onAction(key as T)}>
          {items.map((item) => (
            <RACMenuItem
              key={item.value}
              id={item.value}
              className={s.item}
              isDisabled={item.isDisabled}
              textValue={item.textValue ?? (typeof item.label === 'string' ? item.label : undefined)}
            >
              {item.label}
            </RACMenuItem>
          ))}
        </RACMenu>
      </RACPopover>
    </MenuTrigger>
  );
}
