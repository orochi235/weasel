// Workspace layouts: how the trials are tiled. One 13.2 square field cut three
// ways, so the glyphs read as a family — bars for rows and columns, cells for
// the grid.
//
// Filled, not outlined, because `grid` in state.mjs is already an outlined
// 3x3 on this exact field: at 16px an outlined layout grid and the snapping
// grid are the same picture. Ink says panes; hairline says the grid you snap
// to.
const A = 3.4;
const SPAN = 13.2;
const GAP = 1.5;
const T = (SPAN - 2 * GAP) / 3; // 3.4 — a bar's thickness, a cell's side
const n = (v) => Math.round(v * 100) / 100;
const AT = [A, n(A + T + GAP), n(A + 2 * (T + GAP))];

const bar = (x, y, w, h) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="currentColor" stroke="none"/>`;

export const LAYOUT = {
  layoutRows: AT.map((y) => bar(A, y, SPAN, T)).join(''),

  layoutColumns: AT.map((x) => bar(x, A, T, SPAN)).join(''),

  layoutGrid: AT.flatMap((y) => AT.map((x) => bar(x, y, T, T))).join(''),
};
