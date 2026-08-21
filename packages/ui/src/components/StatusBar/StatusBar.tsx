import type { ReactNode } from 'react';
import s from './StatusBar.module.css';

/** Props for {@link StatusBar}. */
export interface StatusBarProps {
  /**
   * Accessible label for the bar. Deliberately not a live region — a status
   * bar's readouts change on every pointer move (zoom, cursor position,
   * selection count), and announcing each one would make a screen reader
   * unusable. Screen-reader users reach the same facts through the controls
   * that own them.
   */
  ariaLabel?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * The thin readout strip along the bottom of an editor window: monospace,
 * one row, items separated by a fixed gap, with an optional spacer that
 * pushes everything after it to the trailing edge.
 *
 * Pure presentation — it holds whatever the app puts in it. Compose with
 * `<StatusBarItem>` and `<StatusBarSpacer>`.
 */
export function StatusBar(props: StatusBarProps) {
  const { ariaLabel, children, className } = props;
  return (
    <footer className={[s.bar, className].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      {children}
    </footer>
  );
}

/** Props for {@link StatusBarItem}. */
export interface StatusBarItemProps {
  /**
   * Hover text. Items that carry one also get a `help` cursor, so the
   * affordance is discoverable rather than hidden behind a hover delay.
   */
  title?: string;
  /**
   * Dim the item and use tabular figures. For reference material that
   * shouldn't compete with live readouts — build stamps, hints, units.
   */
  muted?: boolean;
  children?: ReactNode;
  className?: string;
}

/** One readout in a `<StatusBar>`. */
export function StatusBarItem(props: StatusBarItemProps) {
  const { title, muted, children, className } = props;
  const cls = [s.item, muted && s.muted, title !== undefined && s.hasTitle, className]
    .filter(Boolean).join(' ');
  return <span className={cls} title={title}>{children}</span>;
}

/**
 * Splits a status bar into leading and trailing runs — everything after the
 * spacer is pushed to the trailing edge. Decorative, so it's hidden from the
 * accessibility tree.
 */
export function StatusBarSpacer() {
  return <span className={s.spacer} aria-hidden="true" />;
}
