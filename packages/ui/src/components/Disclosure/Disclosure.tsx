import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import { composeHandler, type DataAttributes } from '../../nativeProps';
import s from './Disclosure.module.css';

/** Props for `<DisclosureMark>`. */
export interface DisclosureMarkProps {
  /** Whether the section it stands for is open: `−` when open, `+` when shut. */
  open: boolean;
  /** Mark size in px, square. Default 13. */
  size?: number;
  className?: string;
}

/**
 * The fold mark alone: a dark violet rounded square holding a `+` while its section is
 * shut and a `−` while it is open. Decorative — it carries no role or label —
 * for a row that is itself the control, such as a tree item or a header
 * button. Anywhere the mark has to be the control, use `<Disclosure>`.
 *
 * Deliberately not part of the icon register, on the same grounds as
 * `DragGrip`: that register is outline strokes at a fixed weight, and
 * this mark is filled.
 */
export function DisclosureMark({ open, size = 13, className }: DisclosureMarkProps) {
  return (
    <svg
      className={className ? `${s.mark} ${className}` : s.mark}
      viewBox="0 0 13 13"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect className={s.lozenge} width="13" height="13" rx="3" />
      {/* One-unit bars centered on 6.5 in an odd box, so at the default size
          both edges land on the pixel grid rather than blurring across it. */}
      <path className={s.sign} d={open ? 'M3 6.5 H10' : 'M3 6.5 H10 M6.5 3 V10'} />
    </svg>
  );
}

/** Props for `<Disclosure>`. Every native `<button>` attribute and handler but the ones it writes itself passes
 *  through: `aria-controls` names the section it opens, and `tabIndex={-1}` keeps it out of the tab order for a row
 *  whose own keys fold it. */
export type DisclosureProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>, 'aria-expanded' | 'aria-label' | 'type' | 'children'
> & DataAttributes & {
  /** Whether the section it controls is open. The consumer owns this. */
  open: boolean;
  /** Called with the state a press asks for, after `onClick`; an `onClick` that calls `preventDefault()` skips it. */
  onOpenChange: (next: boolean) => void;
  /**
   * Names the section, for a screen reader. The control has no text of its
   * own, so without this it announces as an unlabeled button.
   */
  label: string;
  /** Mark size in px. The hit target is at least 20px and grows with it.
   *  Default 13. */
  size?: number;
};

/**
 * The twisty on a collapsible section: a `<DisclosureMark>` in a button.
 *
 * Presentational — it holds no open/closed state and renders no children.
 * The consumer owns the state and the panel.
 *
 * The mark is drawn rather than typed, because `--wzl-font-ui` carries no ▸/▾
 * and a text glyph falls back to whatever the system offers. The hit target is
 * larger than the mark. And it is a sibling of the row's label rather than a
 * child, so clicking to expand does not actuate the label's own control.
 *
 * `ref` forwards to the `<button>`.
 */
export const Disclosure = forwardRef(function Disclosure(
  { open, onOpenChange, label, size = 13, className, onClick, ...native }: DisclosureProps,
  ref: Ref<HTMLButtonElement>,
) {
  return (
    <button
      {...native}
      ref={ref}
      type="button"
      className={className ? `${s.twisty} ${className}` : s.twisty}
      aria-expanded={open}
      aria-label={label}
      onClick={composeHandler(onClick, () => onOpenChange(!open))}
    >
      <DisclosureMark open={open} size={size} />
    </button>
  );
});

/** Props for `<DisclosureRow>`. */
export type DisclosureRowProps = Omit<DisclosureProps, 'className'> & {
  /** The row's own content — a label, a checkbox, a count. */
  children: ReactNode;
  /** The row's, not the twisty's. */
  className?: string;
};

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
