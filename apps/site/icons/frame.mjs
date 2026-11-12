import { px } from '../../../packages/icons/scripts/lib/base.mjs';

// The badge every release-filter glyph sits in: a rounded square on pixel centers at 16px 1x. What it
// holds may use the frame's whole interior, up to its inner edge, and may cross onto or past the frame
// where the drawing calls for it (ruled 2026-11-12).
export const FRAME = `<rect x="${px(1)}" y="${px(1)}" width="${px(14) - px(1)}" height="${px(14) - px(1)}" rx="3.5" stroke-width="1"/>`;

export const framed = (set) => Object.fromEntries(Object.entries(set).map(([k, body]) => [k, FRAME + body]));
