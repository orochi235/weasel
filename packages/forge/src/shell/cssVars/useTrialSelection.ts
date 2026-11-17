import { type AxisDefs, isColorModePreference, type AxisChoice } from '@weasel-js/theme';
import { useResolvedColorMode } from '@weasel-js/theme/react';
import { useMemo } from 'react';
import type { StoryGlobals } from '../../protocol/messages';
import { selectionFor } from './saveScales';

/**
 * The axis values a trial renders under. A mode global naming a preference rather than one of the axis's values,
 * as `auto` does, follows the OS scheme, which is what the story's root is given.
 */
export function useTrialSelection(axes: AxisDefs, globals: StoryGlobals): AxisChoice {
  const { mode } = globals;
  const osMode = useResolvedColorMode(isColorModePreference(mode) ? mode : 'auto');
  return useMemo(() => {
    const selection = selectionFor(axes, globals);
    return axes.mode && Object.hasOwn(axes.mode.values, osMode) ? { mode: osMode, ...selection } : selection;
  }, [axes, globals, osMode]);
}
