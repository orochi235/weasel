import { createGuidesLayer, createRulers, guideSnapSource, useGuides } from '@weasel-js/guides';
import { useMemo } from 'react';
import type { AppCommands } from './appCommands';
import { DOCUMENT_SCOPE, RULER_LENGTHS } from './documentUnits';
import { usePref } from './prefs';

/**
 * The rulers and the guides dragged off them, driven by the View preferences: the rulers while
 * "Show rulers" is on, and the guides' layer and snap source whether or not they are shown. The
 * guides live for the session; the document does not save them.
 */
export function useRulers() {
  const [visible, setVisible] = usePref('view.rulersVisible');
  const { addGuide, removeGuide, getGuides, subscribe } = useGuides();
  const rulers = useMemo(() => createRulers({ guides: { addGuide, removeGuide, getGuides }, root: DOCUMENT_SCOPE, lengths: RULER_LENGTHS }), [addGuide, removeGuide, getGuides]);
  const layer = useMemo(
    () => createGuidesLayer({ getGuides: () => rulers.settled(getGuides()), subscribe, extent: 'full' }),
    [rulers, getGuides, subscribe],
  );
  const snapSource = useMemo(() => guideSnapSource({ getGuides }), [getGuides]);

  const commands: Pick<AppCommands, 'rulersVisible' | 'toggleRulers'> = {
    rulersVisible: visible,
    toggleRulers: () => setVisible(!visible),
  };

  return { commands, rulers: visible ? rulers : null, layer, snapSource };
}
