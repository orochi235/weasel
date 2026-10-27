import { chevron, GRID_HEAD, px, TRAY } from '../../icons/scripts/lib/base.mjs';

export const FILES = {
  // `export`'s tray, the arrow leaving it.
  import: `
    ${TRAY}
    <path d="M${px(7)} ${px(9)}V${px(2)}"/>
    <path d="${chevron([px(7), px(2)], [0, -1], ...GRID_HEAD)}"/>`,

  // A disk: the cut corner, the shutter and the label.
  save: `
    <path d="M4.4 5.6A1.2 1.2 0 0 1 5.6 4.4h7.2l2.8 2.8v7.2a1.2 1.2 0 0 1-1.2 1.2H5.6a1.2 1.2 0 0 1-1.2-1.2z"/>
    <path d="M7.4 4.6v2.8h4"/>
    <path d="M7 15.4v-4.2h6v4.2"/>`,

  // A folder with its front leaning open.
  open: `
    <path d="M3.4 14.6V6a1.4 1.4 0 0 1 1.4-1.4h3l1.6 1.8h4.8A1.4 1.4 0 0 1 15.6 7.8v1.4"/>
    <path d="M3.4 14.6 5.4 10a1.3 1.3 0 0 1 1.2-.8h9.2a.8.8 0 0 1 .74 1.1L14.9 14.8a1.3 1.3 0 0 1-1.2.8H4.2a.8.8 0 0 1-.8-1z"/>`,
};
