import { useContext, useId, useLayoutEffect, useState, type RefObject } from 'react';
import { KeyBankContext } from './keyBankContext';
import { clampScale, pickSpelling, spellingsOf, type LegendFit } from './legendFit';

/** Vertical room kept clear inside the key, for the thicker bottom border. */
const ROOM_H_SLACK = 4;

let probe: HTMLSpanElement | null = null;

/** Measures text with a hidden span rather than a canvas, so the width is the
 *  one the page lays out. Zero means this environment has no layout. */
function textWidth(text: string, cs: CSSStyleDeclaration, size: number): number {
  if (!probe) {
    probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', left: '-9999px', top: '0' });
  }
  if (!probe.isConnected) document.body.appendChild(probe);
  Object.assign(probe.style, {
    fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle,
    fontStretch: cs.fontStretch, letterSpacing: cs.letterSpacing, fontSize: `${size}px`,
  });
  probe.textContent = text;
  return probe.getBoundingClientRect().width;
}

function measureForms(kbd: HTMLElement, forms: readonly string[]): LegendFit[] | null {
  const cs = getComputedStyle(kbd);
  const px = (v: string) => parseFloat(v) || 0;
  const applied = px(cs.getPropertyValue('--key-legend-scale')) || 1;
  const size = px(cs.fontSize) / applied;
  if (!size) return null;
  const lineHeight = px(cs.getPropertyValue('--key-wrap-line-height')) || 1;
  const roomW = kbd.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
  const roomH = kbd.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom) - ROOM_H_SLACK;
  const fits: LegendFit[] = [];
  for (const label of forms) {
    const lines = label.split('\n');
    const wide = Math.max(...lines.map((l) => textWidth(l, cs, size)));
    if (!wide) return null;
    const tall = lines.length * size * (lines.length > 1 ? lineHeight : 1);
    fits.push({ label, lines: lines.length, scale: Math.min(roomW / wide, roomH / tall) });
  }
  return fits;
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
 * print, whether the key is in a bank, and the key's own scale when its spelling is a two-line one. Outside
 * a bank it measures nothing and returns the label unchanged.
 */
export function useLegendFit(
  ref: RefObject<HTMLElement | null>,
  label: string,
  wrapOverride: boolean | undefined,
  font: string | undefined,
): { label: string; banked: boolean; wrapped: boolean; scale?: number } {
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

  const banked = !!bank;
  if (!bank || !fit || fit.for !== label) return { label, banked, wrapped: false };
  return fit.wrapped
    ? { label: fit.label, banked, wrapped: true, scale: clampScale(fit.scale, bank.minScale) }
    : { label: fit.label, banked, wrapped: false };
}
