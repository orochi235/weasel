/** A sequence page as a scene: one root holding its data, inside the page's margin. */
import type { Vec2 } from '@weasel-js/core/math';
import { sequenceLayout, sequenceSpecs, themeFont, type DiagramSpec, type DiagramTheme, type MeasureRowText } from '@weasel-js/diagram';
import type { SequencePage } from './document';
import { PAGE_MARGIN } from './pageLayout';

type Draw = { theme: DiagramTheme; measure?: MeasureRowText };

/** The id of the root a sequence page's data is drawn under. */
export const sequenceRootIdOf = (pageId: string): string => `${pageId}/sequence`;

/** `page`'s size, grown to hold its layout and the margin around it. */
export function sequencePageSize(page: SequencePage, draw: Draw): { width: number; height: number } {
  const layout = sequenceLayout(page.data, { font: themeFont(draw.theme), ...(draw.measure ? { measure: draw.measure } : {}) });
  return {
    width: Math.max(page.width, layout.width + PAGE_MARGIN * 2),
    height: Math.max(page.height, layout.height + PAGE_MARGIN * 2),
  };
}

/** The specs of `page` placed with its top-left corner at `at`. */
export function sequencePageSpecs(page: SequencePage, at: Vec2, draw: Draw): DiagramSpec[] {
  return sequenceSpecs(page.data, {
    id: sequenceRootIdOf(page.id), at: { x: at.x + PAGE_MARGIN, y: at.y + PAGE_MARGIN }, theme: draw.theme,
    ...(draw.measure ? { measure: draw.measure } : {}),
  });
}
