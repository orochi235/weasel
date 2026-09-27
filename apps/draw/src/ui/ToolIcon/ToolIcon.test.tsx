import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  EllipseIcon, ImageIcon, KIT_SHAPE_KINDS, LassoIcon, LineIcon, PenIcon, PencilIcon, PolygonIcon,
  RectIcon, StarIcon, TextIcon, UnknownIcon,
} from '@weasel-js/core';
import { ToolIcon } from './ToolIcon';

describe('ToolIcon', () => {
  const GLYPHS = {
    rect: RectIcon, ellipse: EllipseIcon, line: LineIcon, polygon: PolygonIcon, star: StarIcon,
    pen: PenIcon, pencil: PencilIcon, lasso: LassoIcon, text: TextIcon, image: ImageIcon,
  };

  it('draws the palette glyph for every kit shape tool', () => {
    for (const tool of [...KIT_SHAPE_KINDS, 'image'] as const) {
      const Glyph = GLYPHS[tool];
      const a = render(<ToolIcon tool={tool} size={16} />).container.innerHTML;
      const b = render(<Glyph size={16} />).container.innerHTML;
      expect(a, tool).toBe(b);
    }
  });

  it('falls back to the unknown glyph for a tool the kit does not ship', () => {
    const a = render(<ToolIcon tool="sprocket" />).container.innerHTML;
    const b = render(<UnknownIcon />).container.innerHTML;
    expect(a).toBe(b);
  });
});
