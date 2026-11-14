import type { ReactNode } from 'react';
import type { OptionKey } from '../optionKey';

/** One option in a `Select`, `ComboBox`, or `MenuButton` list. */
export type ListOption<T extends OptionKey = string> = {
  value: T;
  label: ReactNode;
  /** A glyph drawn before `label`, in the list and in a `Select`'s trigger. */
  icon?: ReactNode;
  /** A line under `label` in the list, saying what the option does, and its accessible description. */
  description?: string;
  /** The option cannot be chosen. */
  disabled?: boolean;
  /** Why the option is disabled, read in the list in place of `description` while `disabled`. */
  disabledReason?: string;
  /**
   * Plain-text form of `label`, for type-to-select, filtering, and screen readers. Only needed when `label` isn't
   * a bare string: a label built from elements has no text React Aria can read off it.
   */
  textValue?: string;
};
