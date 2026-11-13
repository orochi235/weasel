import { deepEqual } from '@weasel-js/registry';
import { useCallback, useMemo, useState } from 'react';
import type { ToolSlotContext } from '../chrome/types';
import type { RenderContext } from '../instrument/types';

type ToolKeys = NonNullable<ToolSlotContext['toolShortcuts']>;
type TrialSlot = Pick<
  RenderContext['trial'],
  'activeToolId' | 'setActiveTool' | 'setToolShortcuts'
>;

/**
 * A trial's tool slot as its instrument sees it (`trial`: the slot and the setter it reports its tools' live keys
 * through) and as its chrome does (`chrome`: the slot and the keys reported). A report reading the same as the last
 * keeps the last, so a canvas re-reporting its keys does not re-render the chrome.
 */
export function useTrialToolSlot(
  activeToolId: string | null,
  setActiveTool: (id: string) => void,
): { trial: TrialSlot; chrome: ToolSlotContext } {
  const [keys, setKeys] = useState<ToolKeys | undefined>(undefined);
  const setToolShortcuts = useCallback(
    (next: ToolKeys) => setKeys((was) => (deepEqual(was, next) ? was : next)),
    [],
  );
  const chrome = useMemo(
    () => ({ activeToolId, setActiveTool, ...(keys ? { toolShortcuts: keys } : {}) }),
    [activeToolId, setActiveTool, keys],
  );
  return { trial: { activeToolId, setActiveTool, setToolShortcuts }, chrome };
}
