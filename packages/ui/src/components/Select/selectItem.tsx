import { createContext, useContext, type ReactNode } from 'react';
import {
  ListBoxItem as RACListBoxItem,
  ListBoxSection as RACListBoxSection,
  Header,
  Text,
  type ListBoxItemProps as RACListBoxItemProps,
} from 'react-aria-components';
import { heldItemProps, useHeldAriaRef } from '../heldItem';
import type { ListOption } from '../listOption';
import type { OptionKey } from '../../optionKey';
import { withIcon } from './optionLabels';
import s from './Select.module.css';

/** True inside `SelectValue`'s copy of the selected row, which shows its label and not its note. */
export const InTrigger = createContext(false);

/* `SelectValue` copies the selected row into the trigger, mark included; the
   trigger hides it, so the `width='fit'` sizer leaves it out. */
function CheckMark() {
  return (
    <svg className={s.check} viewBox="0 0 10 10" aria-hidden="true">
      <polyline points="1.5,5 4,7.5 8.5,3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function renderOption<T extends OptionKey>(o: ListOption<T>) {
  return (
    <SelectItem
      key={String(o.value)} id={o.value} disabled={o.disabled} icon={o.icon} textValue={o.textValue}
      description={o.description} disabledReason={o.disabledReason}
    >
      {o.label}
    </SelectItem>
  );
}

/** Props for {@link SelectSection}. */
export type SelectSectionProps = {
  /** Heading shown above the section's rows; it also names the group for
   *  screen readers. */
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** A titled group of `SelectItem` rows in a {@link Select}'s list. */
export function SelectSection({ title, children, className }: SelectSectionProps) {
  return (
    <RACListBoxSection className={[s.section, className].filter(Boolean).join(' ')}>
      {title !== undefined && <Header className={s.sectionHeader}>{title}</Header>}
      {children}
    </RACListBoxSection>
  );
}

/** Props for {@link SelectItem}, on top of React Aria's `ListBoxItem` props. */
export type SelectItemProps = Omit<RACListBoxItemProps, 'className' | 'children' | 'isDisabled'> & {
  children?: ReactNode;
  /** The row cannot be chosen. */
  disabled?: boolean;
  /** A glyph drawn before the label, in the list and in the trigger. */
  icon?: ReactNode;
  /** A line under the label in the list, and the row's accessible description. */
  description?: string;
  /** Why the row is disabled, in place of `description` while `disabled`. */
  disabledReason?: string;
  className?: string;
};

/**
 * Every row renders a check mark beside its label, so from React Aria's
 * side the children are never plain text and it can't derive the string
 * type-to-select and screen readers need — it warns once per row. A string
 * label already *is* that string, so derive it rather than making every
 * call site restate it; anything richer has to say what it reads as.
 */
function textValueOf(children: ReactNode, explicit: string | undefined): string | undefined {
  if (explicit !== undefined) return explicit;
  return typeof children === 'string' || typeof children === 'number'
    ? String(children)
    : undefined;
}

/**
 * One row in a {@link Select}'s list, with a leading check mark when
 * selected. A string child supplies its own `textValue`; anything richer must
 * pass one so type-to-select and screen readers have something to read.
 */
export function SelectItem({ children, icon, className, textValue, description, disabled, disabledReason, ...rest }: SelectItemProps) {
  const note = (disabled && disabledReason) || description;
  const row = useHeldAriaRef(disabled);
  return (
    <RACListBoxItem
      {...rest}
      ref={row}
      {...heldItemProps(disabled)}
      textValue={textValueOf(children, textValue)}
      className={[s.option, className].filter(Boolean).join(' ')}
    >
      <CheckMark />
      {note ? (
        <span className={s.optionBody}>
          {/* A description slot needs a label slot beside it, or the row's name takes in the description too. */}
          <OptionLabel>{withIcon(icon, <Text slot="label">{children}</Text>)}</OptionLabel>
          <OptionNote>{note}</OptionNote>
        </span>
      ) : <OptionLabel>{withIcon(icon, children)}</OptionLabel>}
    </RACListBoxItem>
  );
}

/** A box around the label alone, not just text and not its note: landing the list over its trigger means
 *  measuring where this row's label line sits. */
function OptionLabel({ children }: { children: ReactNode }) {
  return <span className={s.optionLabel}>{children}</span>;
}

function OptionNote({ children }: { children: string }) {
  return useContext(InTrigger) ? null : <Text slot="description" className={s.note}>{children}</Text>;
}
