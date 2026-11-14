import {
  ListBox,
  ListBoxItem,
  ListBoxSection,
  type ListBoxItemProps,
  type ListBoxProps,
  type ListBoxSectionProps,
} from 'react-aria-components';
import { railClass } from './railClass';
import s from './RailList.module.css';

/** Props for {@link RailListBox}. */
export type RailListBoxProps<T extends object> = Omit<ListBoxProps<T>, 'className'> & { className?: string };

/** A rail a reader selects from: a `listbox` of {@link RailOption}s, set as a {@link RailList} is. */
export function RailListBox<T extends object>({ className, ...rest }: RailListBoxProps<T>) {
  return <ListBox {...rest} className={railClass(s.list, className)} />;
}

/** Props for {@link RailOption}. */
export type RailOptionProps<T extends object> = Omit<ListBoxItemProps<T>, 'className'> & {
  className?: string;
  /** The option is the one shown, filled with the accent: it carries `data-rail-mark="current"`. */
  current?: boolean;
};

/** One `option` on a {@link RailListBox}, set as a {@link RailItem} is. */
export function RailOption<T extends object>({ className, current = false, ...rest }: RailOptionProps<T>) {
  return <ListBoxItem {...rest} className={railClass(s.item, className)} data-rail-mark={current ? 'current' : undefined} />;
}

/** Props for {@link RailSection}. */
export type RailSectionProps<T extends object> = Omit<ListBoxSectionProps<T>, 'className'> & {
  className?: string;
  /** Bracket the section's options as a `Tree` brackets an open branch, from under its heading's glyph. */
  guide?: boolean;
};

/** A heading and the options under it on a {@link RailListBox}. */
export function RailSection<T extends object>({ className, guide = false, ...rest }: RailSectionProps<T>) {
  return <ListBoxSection {...rest} className={railClass(guide ? `${s.section} ${s.guide}` : s.section, className)} />;
}
