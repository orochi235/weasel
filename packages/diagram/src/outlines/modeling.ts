/**
 * Modeling figures: a UML component, and the double-bordered rect an ERD's
 * weak entity wears.
 */
import { PathBuilder, rectPath } from '@weasel-js/core/math';
import type { Bounds, OutlineDef } from './types';

/** The component glyph's body, its tabs, and its margin from the box's corner. */
const ICON = { width: 14, height: 12, tab: { width: 6, height: 3 }, margin: 6 };
/** The room the glyph keeps clear on each side, so a centered label never runs under it. */
const ICON_SIDE = ICON.margin * 2 + ICON.width + ICON.tab.width / 2;

const component: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => rectPath(x, y, w, h),
  // The UML component glyph in the top-right corner: a body with two tabs across its left edge,
  // the edge broken where each tab crosses it.
  detail: ({ x, y, width: w }) => {
    const left = x + w - ICON.margin - ICON.width;
    const top = y + ICON.margin;
    const { width: tw, height: th } = ICON.tab;
    const tabs = [top + 2, top + ICON.height - 2 - th];
    const b = new PathBuilder()
      .moveTo(left, tabs[0]!).lineTo(left, top).lineTo(left + ICON.width, top)
      .lineTo(left + ICON.width, top + ICON.height).lineTo(left, top + ICON.height).lineTo(left, tabs[1]! + th)
      .moveTo(left, tabs[0]! + th).lineTo(left, tabs[1]!);
    for (const t of tabs) b.moveTo(left - tw / 2, t).lineTo(left + tw / 2, t).lineTo(left + tw / 2, t + th).lineTo(left - tw / 2, t + th).close();
    return b.build();
  },
  content: ({ x, y, width: w, height: h }) => {
    const side = Math.min(ICON_SIDE, w / 4);
    return { x: x + side, y, width: w - side * 2, height: h };
  },
  boxForContent: (c) => ({ width: c.width + ICON_SIDE * 2, height: c.height }),
};

/** The gap between a double rect's two borders. */
const GAP = 4;
const gapOf = (w: number, h: number): number => Math.min(GAP, w / 4, h / 4);
const inset = ({ x, y, width: w, height: h }: Bounds, g: number): Bounds => ({ x: x + g, y: y + g, width: w - g * 2, height: h - g * 2 });

const doubleRect: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => rectPath(x, y, w, h),
  detail: (b) => {
    const i = inset(b, gapOf(b.width, b.height));
    return rectPath(i.x, i.y, i.width, i.height);
  },
  content: (b) => inset(b, gapOf(b.width, b.height)),
  boxForContent: (c) => ({ width: c.width + GAP * 2, height: c.height + GAP * 2 }),
};

export const MODELING_OUTLINES = { component, doubleRect };
