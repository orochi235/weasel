import { px } from '../../../packages/icons/scripts/lib/base.mjs';

// The badge every release-filter glyph sits in: a rounded square on pixel centers at 16px 1x. What it
// holds keeps its stroke centers within 4.4–15.6, a clear pixel inside the frame's inner edge.
export const FRAME = `<rect x="${px(1)}" y="${px(1)}" width="${px(14) - px(1)}" height="${px(14) - px(1)}" rx="3.5" stroke-width="1"/>`;

export const framed = (set) => Object.fromEntries(Object.entries(set).map(([k, body]) => [k, FRAME + body]));
