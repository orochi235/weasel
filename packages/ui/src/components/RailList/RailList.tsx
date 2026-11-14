import type { ButtonHTMLAttributes, HTMLAttributes, Ref } from 'react';
import { Text, type TextProps } from 'react-aria-components';
import { railClass } from './railClass';
import s from './RailList.module.css';

/** Props for {@link RailList}. */
export interface RailListProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

/**
 * A rail's entries, one under another: the list a settings dialog's pages are
 * picked from. It takes no role, so its entries are buttons a reader moves
 * between; for a list a reader selects from, use {@link RailListBox}.
 */
export function RailList({ className, ...rest }: RailListProps) {
  return <div {...rest} className={railClass(s.list, className)} />;
}

/** What {@link RailItem}'s `current` marks: the open page, unless it names another kind of `aria-current`. */
export type RailCurrent = boolean | 'page' | 'step' | 'location' | 'date' | 'time';

/** Props for {@link RailItem}. */
export interface RailItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-current'> {
  /** The entry is the one open: it is `aria-current` (`'page'` for `true`) and carries `data-rail-mark="current"`. */
  current?: RailCurrent;
  ref?: Ref<HTMLButtonElement>;
}

/** One entry on a {@link RailList}: a button, filled with the accent while it is the current one. */
export function RailItem({ current = false, className, type = 'button', ...rest }: RailItemProps) {
  return (
    <button
      {...rest}
      type={type}
      className={railClass(s.item, className)}
      aria-current={current === false ? undefined : current === true ? 'page' : current}
      data-rail-mark={current === false ? undefined : 'current'}
    />
  );
}

/** An entry's name, cut short with an ellipsis where the rail is too narrow for it. Pass `slot="label"` in a
 *  {@link RailOption}, as with any `Text`. */
export function RailName({ className, ...rest }: Omit<TextProps, 'className'> & { className?: string }) {
  return <Text {...rest} className={railClass(s.name, className)} />;
}
