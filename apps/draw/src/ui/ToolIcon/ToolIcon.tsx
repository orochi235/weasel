import type { BuiltinShapeToolId } from '@weasel-js/core';
import type { IconRef } from '@weasel-js/icons';
import { Icon, type IconProps } from '@weasel-js/ui/components/Icon';
import { icon } from '../../icons.gen';

/** The kit's shape tools. `image` is one even though `useBuiltinShapeTools`
 *  does not mount it. */
type ShapeToolId = BuiltinShapeToolId | 'image';

const BY_TOOL = {
  rect: icon('core:rect'),
  ellipse: icon('core:ellipse'),
  line: icon('core:line'),
  polygon: icon('core:polygon'),
  star: icon('core:star'),
  pen: icon('core:pen'),
  pencil: icon('core:pencil'),
  lasso: icon('core:lasso'),
  text: icon('core:text'),
  sticky: icon('core:sticky'),
  image: icon('core:image'),
} satisfies Record<ShapeToolId, IconRef>;

export interface ToolIconProps extends IconProps {
  /** A kit shape tool's id. Any other id draws `core:unknown`. */
  tool: ShapeToolId | (string & {});
}

/** The glyph a kit shape tool shows in the palette, looked up by tool id. */
export function ToolIcon({ tool, ...props }: ToolIconProps) {
  const ref = (BY_TOOL as Record<string, IconRef>)[tool] ?? icon('core:unknown');
  return <Icon name={ref} {...props} />;
}
