import type { ReactNode } from 'react';
import { holdScope, type HoldProps } from '../Disabled';
import s from './barParts.module.css';

/** Props for {@link BarGroup}. `disabled` and `readOnly` hold every control in it. */
export interface BarGroupProps extends HoldProps {
  children: ReactNode;
  /** Pushes this group, and everything after it, to the far end. */
  end?: boolean;
  'aria-label'?: string;
  className?: string;
}

/** Related controls, kept tight and set off from what is beside them by a divider. One unit on the line: it overflows
 *  into the menu whole. */
export function BarGroup(props: BarGroupProps) {
  const { children, 'aria-label': ariaLabel, className } = props;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group inside role="toolbar" is the APG pattern. <fieldset> means form controls, needs a <legend> to be named, and its UA min-width breaks flex children.
    <div className={[s.group, className].filter(Boolean).join(' ')} role="group" aria-label={ariaLabel}>
      {holdScope(props, children)}
    </div>
  );
}

/** Flexible space that pushes what follows to the far end of the bar. A bar draws it; alone it draws nothing. */
export function BarSpacer(): null {
  return null;
}

/** A rule between what is either side of it. Never drawn at either end of a line, beside a spacer, or twice in a row.
 *  A bar draws it; alone it draws nothing. */
export function BarDivider(): null {
  return null;
}

/** Props for {@link BarItem}. */
export interface BarItemProps {
  /** What the bar keys the item by: the overflow menu, a reorder, and `order` all name it so. A dotted path's last
   *  segment is its key within `in`. */
  id: string;
  /** The container a reorder moves the item within: `''` at the bar's top level. Unset, the item does not move. */
  in?: string;
  /** Draws a rule in the item's place, set across whichever line it lands on. Unlike a divider it keeps its spot. */
  rule?: boolean;
  /** Attributes for the element the bar wraps the item in. */
  attrs?: Record<string, string | undefined>;
  children?: ReactNode;
}

/** One thing on a bar's line under a key of its own, for content a walker draws: a bar reads its props, and alone it
 *  draws its children. */
export function BarItem({ children }: BarItemProps) {
  return <>{children}</>;
}

/** Props for {@link BarReadout}. */
export interface BarReadoutProps {
  /** Hover text. A readout with one also gets a `help` cursor, so the hover is found rather than waited for. */
  title?: string;
  /** Dims the readout, for reference that should not compete with live readouts: a build stamp, a hint, a unit. */
  muted?: boolean;
  children?: ReactNode;
  className?: string;
}

/** One readout on a bar: a status strip's words, never wrapping. */
export function BarReadout({ title, muted, children, className }: BarReadoutProps) {
  const cls = [s.readout, muted && s.muted, title !== undefined && s.hasTitle, className].filter(Boolean).join(' ');
  return <span className={cls} title={title}>{children}</span>;
}
