import { useMemo } from 'react';
import { useActionsRegistry } from '../interactions/actions/ActionsProvider';
import { describeKeymap, type KeymapDescription } from './describeKeymap';
import { useInnermostKeymap } from './useInnermostKeymap';

/** The innermost keymap open on the canvas in scope, described for a hint, or
 *  `null` while none is. Re-renders as keymaps open and close. */
export function useOpenKeymap(): KeymapDescription | null {
  const registry = useActionsRegistry();
  const open = useInnermostKeymap();
  return useMemo(
    () => (open ? describeKeymap(open, registry?.list() ?? [], registry?.bindingOverrides()) : null),
    [open, registry],
  );
}
