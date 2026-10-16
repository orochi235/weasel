import { useMemo } from 'react';
import { useKitSetting } from '@weasel-js/react';
import type { TargetSizesPx } from './targets';

/** The unscaled chrome sizes the `targets` kit settings give, for `targetSizesPx`'s `base`. */
export function useTargetBasePx(): Partial<TargetSizesPx> {
  const handle = useKitSetting('targets.handlePx');
  const anchor = useKitSetting('targets.anchorHitPx');
  const rotationDistance = useKitSetting('targets.rotationDistancePx');
  return useMemo(() => ({ handle, anchor, rotationDistance }), [handle, anchor, rotationDistance]);
}
