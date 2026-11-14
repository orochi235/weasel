import { useContext, useId, useLayoutEffect, useState, type RefObject } from 'react';
import { useFitScale } from '../FitLabel/FitLabel';
import { measureLegend, samePick, type LegendPick } from './legendMeasure';
import { KeyBankContext } from './keyBankContext';
import { clampScale, KEY_SPELLINGS } from './legendFit';

interface Fit extends LegendPick {
  for: string;
}

/**
 * Joins a key to the scale stage of its enclosing fit scope — a `KeyBank`'s —
 * which picks the spelling it prints and the scale it shares. Returns the label
 * to print, whether the key is banked, and the key's own scale when its
 * spelling is a two-line one. Only a `fixed` key — one whose box its layout
 * sizes — is fitted: a key sized by its legend has no room of its own to fit,
 * so it prints its first spelling at the bank's scale. Outside a scale stage
 * nothing is measured.
 */
export function useLegendFit(
  ref: RefObject<HTMLElement | null>,
  label: string,
  { wrap: wrapOverride, font, fixed }: { wrap: boolean | undefined; font: string | undefined; fixed: boolean },
): { label: string; banked: boolean; wrapped: boolean; scale?: number } {
  const scale = useFitScale();
  const bank = useContext(KeyBankContext);
  const id = useId();
  const [fit, setFit] = useState<Fit | null>(null);
  const wrap = wrapOverride ?? bank?.wrap ?? false;
  const spellings = bank?.spellings ?? KEY_SPELLINGS;

  useLayoutEffect(() => {
    const kbd = ref.current;
    if (!scale || !kbd || !fixed) return;
    scale.join(id, {
      el: kbd,
      measure: () => measureLegend(kbd, label, { spellings, wrap, minScale: scale.min }),
      onFit: (pick) => setFit({ ...pick, for: label }),
      same: samePick,
    });
    return () => scale.leave(id);
  }, [ref, scale, id, label, wrap, spellings, font, fixed]);

  const banked = !!scale;
  if (!scale || !fixed || !fit || fit.for !== label) return { label, banked, wrapped: false };
  return fit.shared
    ? { label: fit.label, banked, wrapped: false }
    : { label: fit.label, banked, wrapped: true, scale: clampScale(fit.scale, scale.min) };
}
