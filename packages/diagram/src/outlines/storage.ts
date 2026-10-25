/**
 * Containers of things: a database cylinder, a document, a note, a folder,
 * and a cube. Each keeps its content box clear of the parts that read as
 * depth or decoration — a cylinder's top cap, a document's wave, a note's fold.
 */
import { PathBuilder, polygonFromPoints } from '@weasel-js/core/math';
import { polylineFromPoints } from '@weasel-js/geom';
import { KAPPA } from './flowchart';
import type { OutlineDef, Size } from './types';

/** A cylinder's cap height: a fraction of its height, flattened for a narrow box. */
const capOf = (w: number, h: number): number => Math.min(h * 0.15, w * 0.25);

/** The top cap's back half and the bottom cap's front half make the silhouette;
 *  the top cap's front half is the rim drawn over the fill. */
const cylinder: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => {
    const ry = capOf(w, h);
    const rx = w / 2;
    const cx = x + rx;
    const top = y + ry;
    const bottom = y + h - ry;
    return new PathBuilder()
      .moveTo(x, top)
      .curveTo(x, top - ry * KAPPA, cx - rx * KAPPA, y, cx, y)
      .curveTo(cx + rx * KAPPA, y, x + w, top - ry * KAPPA, x + w, top)
      .lineTo(x + w, bottom)
      .curveTo(x + w, bottom + ry * KAPPA, cx + rx * KAPPA, y + h, cx, y + h)
      .curveTo(cx - rx * KAPPA, y + h, x, bottom + ry * KAPPA, x, bottom)
      .close()
      .build();
  },
  detail: ({ x, y, width: w, height: h }) => {
    const ry = capOf(w, h);
    const rx = w / 2;
    const cx = x + rx;
    const top = y + ry;
    return new PathBuilder()
      .moveTo(x, top)
      .curveTo(x, top + ry * KAPPA, cx - rx * KAPPA, top + ry, cx, top + ry)
      .curveTo(cx + rx * KAPPA, top + ry, x + w, top + ry * KAPPA, x + w, top)
      .build();
  },
  content: ({ x, y, width: w, height: h }) => {
    const ry = capOf(w, h);
    return { x, y: y + ry * 2, width: w, height: Math.max(h - ry * 3, 0) };
  },
  boxForContent: (c) => ({ width: c.width, height: c.height / 0.55 }),
};

/** A document's wave: its depth below and above the midline, of the height. */
const WAVE = 0.1;
/** A cubic whose controls sit `k` either side of its chord peaks at k·√3/6. */
const WAVE_CONTROL = 6 / Math.sqrt(3);

const document: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => {
    const a = h * WAVE;
    const mid = y + h - a;
    const k = a * WAVE_CONTROL;
    return new PathBuilder()
      .moveTo(x, y)
      .lineTo(x + w, y)
      .lineTo(x + w, mid)
      .curveTo(x + (w * 2) / 3, mid - k, x + w / 3, mid + k, x, mid)
      .close()
      .build();
  },
  content: ({ x, y, width: w, height: h }) => ({ x, y, width: w, height: h * (1 - WAVE * 2) }),
  boxForContent: (c) => ({ width: c.width, height: c.height / (1 - WAVE * 2) }),
};

const MAX_FOLD = 20;
const foldOf = (w: number, h: number): number => Math.min(MAX_FOLD, Math.min(w, h) / 4);

const note: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => {
    const f = foldOf(w, h);
    return polygonFromPoints([
      { x, y }, { x: x + w - f, y }, { x: x + w, y: y + f }, { x: x + w, y: y + h }, { x, y: y + h },
    ]);
  },
  detail: ({ x, y, width: w, height: h }) => {
    const f = foldOf(w, h);
    return polylineFromPoints([{ x: x + w - f, y }, { x: x + w - f, y: y + f }, { x: x + w, y: y + f }]);
  },
  content: ({ x, y, width: w, height: h }) => {
    const f = foldOf(w, h);
    return { x, y: y + f, width: w, height: h - f };
  },
  boxForContent: (c) => ({ width: c.width, height: c.height + MAX_FOLD }),
};

const MAX_TAB = 16;
const tabOf = (w: number, h: number) => {
  const t = Math.min(MAX_TAB, h * 0.2);
  return { t, tw: Math.max(Math.min(w * 0.4, w - t * 2), 0) };
};

const folder: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => {
    const { t, tw } = tabOf(w, h);
    return polygonFromPoints([
      { x, y }, { x: x + tw, y }, { x: x + tw + t, y: y + t }, { x: x + w, y: y + t },
      { x: x + w, y: y + h }, { x, y: y + h },
    ]);
  },
  detail: ({ x, y, width: w, height: h }) => {
    const { t, tw } = tabOf(w, h);
    return polylineFromPoints([{ x, y: y + t }, { x: x + tw + t, y: y + t }]);
  },
  content: ({ x, y, width: w, height: h }) => {
    const { t } = tabOf(w, h);
    return { x, y: y + t, width: w, height: h - t };
  },
  boxForContent: (c) => ({ width: c.width, height: c.height + MAX_TAB }),
};

/** A cube's depth, of the shorter side. */
const DEPTH = 0.15;

/** The box whose sides, less `k` of the shorter one, are `c`. */
export function insetByShorter(c: Size, k: number): Size {
  const d = (k * Math.min(c.width, c.height)) / (1 - k);
  return { width: c.width + d, height: c.height + d };
}

/** The front face is the content; the edges it shares with the top and right
 *  faces are the detail. */
const cube: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => {
    const d = Math.min(w, h) * DEPTH;
    return polygonFromPoints([
      { x, y: y + d }, { x: x + d, y }, { x: x + w, y }, { x: x + w, y: y + h - d },
      { x: x + w - d, y: y + h }, { x, y: y + h },
    ]);
  },
  detail: ({ x, y, width: w, height: h }) => {
    const d = Math.min(w, h) * DEPTH;
    return new PathBuilder()
      .moveTo(x, y + d).lineTo(x + w - d, y + d).lineTo(x + w, y)
      .moveTo(x + w - d, y + d).lineTo(x + w - d, y + h)
      .build();
  },
  content: ({ x, y, width: w, height: h }) => {
    const d = Math.min(w, h) * DEPTH;
    return { x, y: y + d, width: w - d, height: h - d };
  },
  boxForContent: (c) => insetByShorter(c, DEPTH),
};

export const STORAGE_OUTLINES = { cylinder, document, note, folder, cube };
