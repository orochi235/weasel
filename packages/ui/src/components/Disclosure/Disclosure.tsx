import type { ReactNode } from 'react';
import s from './Disclosure.module.css';

/** Props for `<DisclosureMark>`. */
export interface DisclosureMarkProps {
  /** Whether the section it stands for is open: `−` when open, `+` when shut. */
  open: boolean;
  /** Mark size in px, square. Default 12. */
  size?: number;
  className?: string;
}

/**
 * The fold mark alone: a violet rounded square holding a `+` while its section is
 * shut and a `−` while it is open. Decorative — it carries no role or label —
 * for a row that is itself the control, such as a tree item or a header
 * button. Anywhere the mark has to be the control, use `<Disclosure>`.
 *
 * Deliberately not part of the icon register, on the same grounds as
 * `DragHandleGlyph`: that register is outline strokes at a fixed weight, and
 * this mark is filled.
 */
export function DisclosureMark({ open, size = 12, className }: DisclosureMarkProps) {
  return (
    <svg
      className={className ? `${s.mark} ${className}` : s.mark}
      viewBox="0 0 12 12"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect className={s.lozenge} width="12" height="12" rx="3" />
      {/* Bars two units thick on whole-unit edges, so at the default size they
          land on the pixel grid rather than blurring across it. */}
      <path className={s.sign} d={open ? 'M3 6 H9' : 'M3 6 H9 M6 3 V9'} />
    </svg>
  );
}

/** Props for `<Disclosure>`. */
export interface DisclosureProps {
  /** Whether the section it controls is open. The consumer owns this. */
  open: boolean;
  onToggle: () => void;
  /**
   * Names the section, for a screen reader. The control has no text of its
   * own, so without this it announces as an unlabeled button.
   */
  label: string;
  /**
   * `id` of the element this expands. Sets `aria-controls`, which lets a
   * screen reader move to the revealed content.
   */
  controls?: string;
  /** Mark height in px. The hit target is at least 20px and grows with it.
   *  Default 12. */
  size?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * The twisty on a collapsible section: a `<DisclosureMark>` in a button.
 *
 * Presentational — it holds no open/closed state and renders no children.
 * The consumer owns the state and the panel; this is the control that toggles
 * it, and `aria-expanded` is what ties the two together.
 *
 * Three things it settles that a hand-rolled twisty keeps getting wrong. The
 * mark is drawn rather than typed, because `--wzl-font-ui` carries no ▸/▾ and
 * a text glyph falls back to whatever the system offers at whatever size that
 * font renders it. The hit target is larger than the mark. And it is a sibling
 * of the row's label rather than a child, so clicking to expand does not
 * actuate the label's own control.
 */
export function Disclosure({ open, onToggle, label, controls, size = 12, disabled, className }: DisclosureProps) {
  return (
    <button
      type="button"
      className={className ? `${s.twisty} ${className}` : s.twisty}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
    >
      <DisclosureMark open={open} size={size} />
    </button>
  );
}

/** Props for `<DisclosureRow>`. */
export interface DisclosureRowProps extends Omit<DisclosureProps, 'className'> {
  /** The row's own content — a label, a checkbox, a count. */
  children: ReactNode;
  className?: string;
}

/**
 * A `<Disclosure>` and a row of content beside it, laid out so the twisty
 * leads and the content takes the rest.
 *
 * The layout is the point: the twisty sits *outside* whatever the row puts in
 * it, so a row whose content is a `<label>` wrapping a checkbox stays
 * clickable as a label without the twisty actuating it.
 */
export function DisclosureRow({ children, className, ...twisty }: DisclosureRowProps) {
  return (
    <div className={className ? `${s.row} ${className}` : s.row}>
      <Disclosure {...twisty} />
      <div className={s.rowBody}>{children}</div>
    </div>
  );
}
