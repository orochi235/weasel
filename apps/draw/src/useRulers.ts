import { createGuidesLayer, createRulers, guideSnapSource, useGuides } from '@weasel-js/guides';
import { useMemo } from 'react';
import type { AppCommands } from './appCommands';
import { DOCUMENT_SCOPE } from './documentUnits';
import { usePref } from './prefs';

/**
 * The rulers and the guides dragged off them, driven by the View preferences: the rulers while
 * "Show rulers" is on, and the guides' layer and snap source whether or not they are shown. The
 * guides live for the session; the document does not save them.
 */
export function useRulers() {
  const [visible, setVisible] = usePref('view.rulersVisible');
  const { addGuide, removeGuide, getGuides, subscribe } = useGuides();
  const rulers = useMemo(() => createRulers({ guides: { addGuide, removeGuide }, root: DOCUMENT_SCOPE }), [addGuide, removeGuide]);
  const layer = useMemo(() => createGuidesLayer({ getGuides, subscribe, extent: 'full' }), [getGuides, subscribe]);
  const snapSource = useMemo(() => guideSnapSource(getGuides), [getGuides]);

  const commands: Pick<AppCommands, 'rulersVisible' | 'toggleRulers'> = {
    rulersVisible: visible,
    toggleRulers: () => setVisible(!visible),
  };

  return { commands, rulers: visible ? rulers : null, layer, snapSource };
}
