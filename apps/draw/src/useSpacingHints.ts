import type { FeaturePreset } from '@weasel-js/core';
import { createSpacingHintsPreset } from '@weasel-js/guides';
import { useMemo } from 'react';
import { usePref } from './prefs';

const HINT_COLOR = '#e0397f';

/** The spacing hints preset while the "Spacing hints" View preference is on. */
export function useSpacingHints(): FeaturePreset | undefined {
  const [enabled] = usePref('view.spacingHints');
  const preset = useMemo(() => createSpacingHintsPreset({ color: HINT_COLOR }), []);
  return enabled ? preset : undefined;
}
