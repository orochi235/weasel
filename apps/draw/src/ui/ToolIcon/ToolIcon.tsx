import type { ComponentType } from 'react';
import {
  EllipseIcon, ImageIcon, LassoIcon, LineIcon, PenIcon, PencilIcon, PolygonIcon, RectIcon,
  StarIcon, TextIcon, UnknownIcon,
  type BuiltinShapeToolId, type IconProps,
} from '@weasel-js/core';

/** The kit's shape tools. `image` is one even though `useBuiltinShapeTools`
 *  does not mount it. */
type ShapeToolId = BuiltinShapeToolId | 'image';

const BY_TOOL = {
  rect: RectIcon,
  ellipse: EllipseIcon,
  line: LineIcon,
  polygon: PolygonIcon,
  star: StarIcon,
  pen: PenIcon,
  pencil: PencilIcon,
  lasso: LassoIcon,
  text: TextIcon,
  image: ImageIcon,
} satisfies Record<ShapeToolId, ComponentType<IconProps>>;

export interface ToolIconProps extends IconProps {
  /** A kit shape tool's id. Any other id draws `UnknownIcon`. */
  tool: ShapeToolId | (string & {});
}

/** The glyph a kit shape tool shows in the palette, looked up by tool id. */
export function ToolIcon({ tool, ...props }: ToolIconProps) {
  const Glyph = (BY_TOOL as Record<string, ComponentType<IconProps>>)[tool] ?? UnknownIcon;
  return <Glyph {...props} />;
}
