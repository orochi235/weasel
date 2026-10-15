import { useContext, useId, useLayoutEffect, useState, type RefObject } from 'react';
import { KeyBankContext } from './keyBankContext';
import { clampScale, pickSpelling, spellingsOf, type LegendFit } from './legendFit';

/** Vertical room kept clear inside the key, for the thicker bottom border. */
const ROOM_H_SLACK = 4;

let measureCtx: CanvasRenderingContext2D | null | undefined;

function measureForms(kbd: HTMLElement, forms: readonly string[]): LegendFit[] | null {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  const ctx = measureCtx;
  if (!ctx) return null;
  const cs = getComputedStyle(kbd);
  const px = (v: string) => parseFloat(v) || 0;
  const applied = px(cs.getPropertyValue('--key-legend-scale')) || 1;
  const size = px(cs.fontSize) / applied;
  if (!size) return null;
  const lineHeight = px(cs.getPropertyValue('--key-wrap-line-height')) || 1;
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
  const roomW = kbd.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
  const roomH = kbd.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom) - ROOM_H_SLACK;
  return forms.map((label) => {
    const lines = label.split('\n');
    const wide = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const tall = lines.length * size * (lines.length > 1 ? lineHeight : 1);
    return { label, lines: lines.length, scale: Math.min(roomW / wide, roomH / tall) };
  });
}

interface Fit {
  for: string;
  label: string;
  wrapped: boolean;
  scale: number;
}

const sameFit = (a: Fit | null, b: Fit) =>
  !!a && a.for === b.for && a.label === b.label && a.wrapped === b.wrapped && Math.abs(a.scale - b.scale) < 0.001;

/**
 * Fits a key's legend inside a `KeyBank`: picks the spelling it prints and
 * reports that spelling's largest scale to the bank. Returns the label to
 * print, and the key's own scale when its spelling is a two-line one. Outside
 * a bank it measures nothing and returns the label unchanged.
 */
export function useLegendFit(
  ref: RefObject<HTMLElement | null>,
  label: string,
  wrapOverride: boolean | undefined,
  font: string | undefined,
): { label: string; wrapped: boolean; scale?: number } {
  const bank = useContext(KeyBankContext);
  const id = useId();
  const [fit, setFit] = useState<Fit | null>(null);
  const wrap = wrapOverride ?? bank?.wrap ?? false;

  useLayoutEffect(() => {
    const kbd = ref.current;
    if (!bank || !kbd) return;
    let live = true;
    const measure = () => {
      if (!live) return;
      const fits = measureForms(kbd, spellingsOf(label, bank.spellings));
      if (!fits) return;
      const best = pickSpelling(fits, { wrap, minScale: bank.minScale });
      const next = { for: label, label: best.label, wrapped: best.lines > 1, scale: best.scale };
      setFit((prev) => (sameFit(prev, next) ? prev : next));
      bank.report(id, { scale: next.scale, wrapped: next.wrapped });
    };
    measure();
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    void fonts?.ready.then(measure);
    fonts?.addEventListener?.('loadingdone', measure);
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resize?.observe(kbd);
    return () => {
      live = false;
      resize?.disconnect();
      fonts?.removeEventListener?.('loadingdone', measure);
      bank.report(id, null);
    };
  }, [ref, bank, id, label, wrap, font]);

  if (!bank || !fit || fit.for !== label) return { label, wrapped: false };
  return fit.wrapped
    ? { label: fit.label, wrapped: true, scale: clampScale(fit.scale, bank.minScale) }
    : { label: fit.label, wrapped: false };
}
