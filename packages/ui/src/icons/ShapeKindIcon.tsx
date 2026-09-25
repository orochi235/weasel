import type { ComponentType } from 'react';
import {
  EllipseIcon, ImageIcon, LassoIcon, LineIcon, PenIcon, PencilIcon, PolygonIcon, RectIcon,
  StarIcon, TextIcon, UnknownIcon,
  type IconProps, type ShapeKind,
} from '@weasel-js/core';

const BY_KIND = {
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
} satisfies Record<ShapeKind, ComponentType<IconProps>>;

export interface ShapeKindIconProps extends IconProps {
  /** A built-in shape kind. Any other string draws `UnknownIcon`, so a
   *  consumer-defined kind still gets a glyph. */
  kind: ShapeKind | (string & {});
}

/** The glyph for a shape kind — the same one its insertion tool shows, so a
 *  row in a layer list or inspector matches the palette that made it. */
export function ShapeKindIcon({ kind, ...props }: ShapeKindIconProps) {
  const Glyph = (BY_KIND as Record<string, ComponentType<IconProps>>)[kind] ?? UnknownIcon;
  return <Glyph {...props} />;
}
