import { maxOf } from '@weasel-js/geom';
import type { ScaleFit } from '../FitLabel/fitScale';
import { pickSpelling, spellingsOf, type KeySpellings, type LegendFit } from './legendFit';
import { cssPx } from '../../cssPx';

/** Vertical room kept clear inside the key, for the thicker bottom border. */
const ROOM_H_SLACK = 4;

/** The spelling a bank member prints, and the largest scale it fits at. A two-line spelling sizes itself rather than
 *  sharing the bank's scale. */
export interface LegendPick extends ScaleFit {
  readonly label: string;
}

export const samePick = (a: LegendPick, b: LegendPick) =>
  a.label === b.label && a.shared === b.shared && Math.abs(a.scale - b.scale) < 0.001;

let measureCtx: CanvasRenderingContext2D | null | undefined;

/** A 2D context for measuring text, or null where none can work: jsdom has no
 *  canvas, and asking it for one logs an error. */
function measureContext(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    const jsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
    measureCtx = jsdom || typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  }
  return measureCtx;
}

interface Room {
  font: string;
  letterSpacing: string;
  size: number;
  lineHeight: number;
  width: number;
  height: number;
}

/** Everything a fit reads from the page, read in one go so a pass over many
 *  keys lays the page out once. */
function readRoom(kbd: HTMLElement): Room | null {
  const cs = getComputedStyle(kbd);
  const applied = cssPx(cs.getPropertyValue('--key-legend-scale')) || 1;
  const size = cssPx(cs.fontSize) / applied;
  if (!size) return null;
  return {
    font: `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`,
    letterSpacing: cs.letterSpacing,
    size,
    lineHeight: cssPx(cs.getPropertyValue('--key-wrap-line-height')) || 1,
    width: kbd.clientWidth - cssPx(cs.paddingLeft) - cssPx(cs.paddingRight),
    height: kbd.clientHeight - cssPx(cs.paddingTop) - cssPx(cs.paddingBottom) - ROOM_H_SLACK,
  };
}

function fitForms(ctx: CanvasRenderingContext2D, room: Room, forms: readonly string[]): LegendFit[] {
  ctx.font = room.font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = room.letterSpacing === 'normal' ? '0px' : room.letterSpacing;
  return forms.map((label) => {
    const lines = label.split('\n');
    const wide = maxOf(lines, (l) => ctx.measureText(l).width);
    const tall = lines.length * room.size * (lines.length > 1 ? room.lineHeight : 1);
    return { label, lines: lines.length, scale: Math.min(room.width / wide, room.height / tall) };
  });
}

/** Fits a key's legend to its box: the spelling it prints, and the largest scale that spelling fits at. Null where
 *  text cannot be measured. */
export function measureLegend(
  kbd: HTMLElement,
  label: string,
  { spellings, wrap, minScale }: { spellings: KeySpellings; wrap: boolean; minScale: number },
): LegendPick | null {
  const ctx = measureContext();
  const room = ctx && readRoom(kbd);
  if (!ctx || !room) return null;
  const best = pickSpelling(fitForms(ctx, room, spellingsOf(label, spellings)), { wrap, minScale });
  return { label: best.label, shared: best.lines === 1, scale: best.scale };
}
