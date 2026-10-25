import { Children, isValidElement, type ReactNode } from 'react';
import listbox from './listbox.module.css';

/** An option as a list declares it: a label and an optional leading glyph. */
type LabeledOption = { label: ReactNode; icon?: ReactNode };

/** A titled group of options. */
type OptionGroup = { options: ReadonlyArray<LabeledOption> };

/**
 * The labels a `width='fit'` control measures itself against, icons included.
 * In the children form the label sits one element deep, inside an item, or two
 * inside an element of type `section`.
 */
export function optionLabels(
  options: ReadonlyArray<LabeledOption | OptionGroup> | undefined,
  children: ReactNode,
  section?: unknown,
): ReactNode[] {
  if (options !== undefined)
    return options.flatMap((o) =>
      'options' in o ? o.options.map((g) => withIcon(g.icon, g.label)) : [withIcon(o.icon, o.label)],
    );
  return Children.toArray(children).flatMap((c) => {
    if (!isValidElement<{ children?: ReactNode; icon?: ReactNode }>(c)) return [c];
    return section !== undefined && c.type === section
      ? optionLabels(undefined, c.props.children, section)
      : [withIcon(c.props.icon, c.props.children)];
  });
}

/** A label led by its icon, as a row draws it. */
export function withIcon(icon: ReactNode, label: ReactNode): ReactNode {
  if (icon === undefined || icon === null) return label;
  return (
    <>
      <span className={listbox.optionIcon} aria-hidden="true">{icon}</span>
      {label}
    </>
  );
}
