import { useContext, useId, useLayoutEffect, useState, type RefObject } from 'react';
import type { LegendPick } from './bankFitter';
import { KeyBankContext } from './keyBankContext';
import { clampScale } from './legendFit';

interface Fit extends LegendPick {
  for: string;
}

/**
 * Joins a key to its `KeyBank`, which picks the spelling it prints and the
 * scale it shares. Returns the label to print, whether the key is in a bank,
 * and the key's own scale when its spelling is a two-line one. Only a `fixed`
 * key — one whose box its layout sizes — is fitted: a key sized by its legend
 * has no room of its own to fit, so it prints its first spelling at the bank's
 * scale. Outside a bank nothing is measured.
 */
export function useLegendFit(
  ref: RefObject<HTMLElement | null>,
  label: string,
  { wrap: wrapOverride, font, fixed }: { wrap: boolean | undefined; font: string | undefined; fixed: boolean },
): { label: string; banked: boolean; wrapped: boolean; scale?: number } {
  const bank = useContext(KeyBankContext);
  const id = useId();
  const [fit, setFit] = useState<Fit | null>(null);
  const wrap = wrapOverride ?? bank?.wrap ?? false;
  const fitter = bank?.fitter;

  useLayoutEffect(() => {
    const kbd = ref.current;
    if (!fitter || !kbd || !fixed) return;
    fitter.join(id, kbd, label, wrap, (pick) => setFit({ ...pick, for: label }));
    return () => fitter.leave(id);
  }, [ref, fitter, id, label, wrap, font, fixed]);

  const banked = !!bank;
  if (!bank || !fixed || !fit || fit.for !== label) return { label, banked, wrapped: false };
  return fit.wrapped
    ? { label: fit.label, banked, wrapped: true, scale: clampScale(fit.scale, bank.minScale) }
    : { label: fit.label, banked, wrapped: false };
}
