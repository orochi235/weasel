/** Props for `<DragHandleGlyph>`. */
export interface DragHandleGlyphProps {
  /** Height in px; width scales with it. Default 16. */
  size?: number;
}

/** The two-column dot grip used on anything draggable by a handle.
 *
 *  Deliberately not part of `@weasel-js/ui`'s icon register: that register is
 *  outline strokes at a fixed weight, and a grip is filled dots. Forcing it in
 *  would either break the register's rule or produce a worse glyph. */
export function DragHandleGlyph({ size = 16 }: DragHandleGlyphProps) {
  return (
    <svg
      width={(size * 8) / 16}
      height={size}
      viewBox="0 0 8 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="2" cy="3" r="1.1" />
      <circle cx="6" cy="3" r="1.1" />
      <circle cx="2" cy="8" r="1.1" />
      <circle cx="6" cy="8" r="1.1" />
      <circle cx="2" cy="13" r="1.1" />
      <circle cx="6" cy="13" r="1.1" />
    </svg>
  );
}
