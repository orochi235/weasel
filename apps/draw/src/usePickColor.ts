import { useActionsRegistry } from '@weasel-js/core';
import { useColorContext } from './tools/colorContext';

/**
 * What a picked color does, wherever it was picked — the eyedropper tool or a
 * click inside the loupe. A pick is the swatch edit arriving from a different
 * control: it sets the focused paint and, through the same action the swatch
 * dispatches, paints the selection with it.
 */
export function usePickColor(): (hex: string) => void {
  const colors = useColorContext();
  const actions = useActionsRegistry();
  return (hex: string) => {
    colors.setFocusedColor(hex);
    actions?.begin(colors.focused === 'fill' ? 'setFill' : 'setStroke', { color: hex })?.end('commit');
  };
}
