import type { ReactNode } from 'react';
import s from './Disclosure.module.css';

/** Which way the mark points when the section is closed. */
export type DisclosureDirection = 'right' | 'down';

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
  /** Which way the closed mark points. `'right'` (default) rotates down when
   *  open; `'down'` rotates up. */
  direction?: DisclosureDirection;
  /** Mark size in px. The hit target is at least 20px and grows with it.
   *  Default 12. */
  size?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * The twisty on a collapsible section: a triangle that turns as it opens.
 *
 * Presentational — it holds no open/closed state and renders no children.
 * The consumer owns the state and the panel; this is the control that toggles
 * it, and `aria-expanded` is what ties the two together.
 *
 * Three things it settles that a hand-rolled twisty keeps getting wrong. The
 * mark is drawn rather than typed, because `--wzl-font-ui` carries no ▸/▾ and
 * a text glyph falls back to whatever the system offers at whatever size that
 * font renders it — around 6px against 13px body text, which reads as dirt on
 * the screen. The hit target is larger than the mark. And it is a sibling of
 * the row's label rather than a child, so clicking to expand does not actuate
 * the label's own control.
 *
 * Deliberately not part of the icon register, on the same grounds as
 * `DragHandleGlyph`: that register is outline strokes at a fixed weight, and
 * `base.mjs` rejects a solid triangle in it by name. A disclosure mark is
 * filled.
 */
export function Disclosure({
  open,
  onToggle,
  label,
  controls,
  direction = 'right',
  size = 12,
  disabled,
  className,
}: DisclosureProps) {
  const cls = [s.twisty, direction === 'down' && s.down, className].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cls}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
    >
      <svg
        className={s.mark}
        viewBox="0 0 12 12"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
        {/* Vertex on the right edge at the vertical center, so the rotation
            about the box center keeps the point on the same circle. */}
        <path d="M4 2.5 L8.5 6 L4 9.5 Z" />
      </svg>
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
