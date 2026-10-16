import { useMemo } from 'react';
import { useKitSetting } from '@weasel-js/react';
import { PARAMS_SETTLES, PARAMS_TEXT_WAIT_MS, type LiveControl, type ParamsSurface } from './commitPolicy';

/** How a params surface writes, with the kit settings a provider sets over the defaults. */
export interface ParamsPolicy {
  /** How long typed text waits for the next key before a control that writes as it changes writes it. */
  textWaitMs: number;
  /** Which live controls write only the value an edit settles on. */
  settles: Readonly<Record<LiveControl, boolean>>;
}

/** `surface`'s {@link ParamsPolicy}: each `params.<surface>` kit setting a provider sets, else its default. */
export function useParamsPolicy(surface: ParamsSurface): ParamsPolicy {
  const defaults = PARAMS_SETTLES[surface];
  const textWaitMs = useKitSetting(`params.${surface}.textWaitMs`) ?? PARAMS_TEXT_WAIT_MS[surface];
  const number = useKitSetting(`params.${surface}.settles.number`) ?? defaults.number;
  const slider = useKitSetting(`params.${surface}.settles.slider`) ?? defaults.slider;
  const string = useKitSetting(`params.${surface}.settles.string`) ?? defaults.string;
  const color = useKitSetting(`params.${surface}.settles.color`) ?? defaults.color;
  const settles = useMemo(() => ({ number, slider, string, color }), [number, slider, string, color]);
  return useMemo(() => ({ textWaitMs, settles }), [textWaitMs, settles]);
}
