/** Shared prop shape for built-in tool icons.
 *
 *  Each icon component is a small SVG `<svg viewBox="0 0 20 20">` with
 *  `currentColor` strokes + filled regions for the affordance. Consumers
 *  size with `size` (rendered as both `width` and `height`) and theme via
 *  the surrounding `color` CSS property.
 */
export interface IconProps {
  className?: string;
  /** Rendered pixel size. Defaults to 20 (matches the viewBox). */
  size?: number;
}
