/** Built-in icons for the kit's tool palette. One per tool today; the
 *  set grows alongside `Tool.presentation.icon` defaults as shape tools
 *  ship (see spec `2026-05-11-shape-tools-and-tool-palette-design.md`).
 *
 *  All icons are 20×20-viewBox `<svg>`s rendered in `currentColor`, with
 *  an optional `size` prop for re-scaling. Sized for direct embedding in
 *  consumer tool buttons or as `Tool.presentation.icon` defaults.
 */
export { default as SelectIcon } from './SelectIcon';
export { default as LassoIcon } from './LassoIcon';
export { default as RectIcon } from './RectIcon';
export { default as EllipseIcon } from './EllipseIcon';
export { default as ImageIcon } from './ImageIcon';
export { default as EyedropperIcon } from './EyedropperIcon';
export { default as LineIcon } from './LineIcon';
export { default as ArrowIcon } from './ArrowIcon';
export { default as PolygonIcon } from './PolygonIcon';
export { default as StarIcon } from './StarIcon';
export { default as PencilIcon } from './PencilIcon';
export { default as TextIcon } from './TextIcon';
export { default as PenIcon } from './PenIcon';
export { default as HandIcon } from './HandIcon';
export { default as UnknownIcon } from './UnknownIcon';
export type { IconProps } from './types';
