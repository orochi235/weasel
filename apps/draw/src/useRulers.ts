import { useEditorRulers } from '@weasel-js/editor';
import type { AppCommands } from './appCommands';
import { DOCUMENT_SCOPE, RULER_LENGTHS } from './documentUnits';
import { usePrefGroup } from './prefs';

/** The editor's rulers, driven by the View preferences, read in points and inches, and toggled by `view.rulers`. */
export function useRulers() {
  const [settings, setSettings] = usePrefGroup('view.rulers');
  const { visible, toggle, rulers, layer, snapSource } = useEditorRulers({
    settings, setSettings, root: DOCUMENT_SCOPE, lengths: RULER_LENGTHS,
  });
  const commands: Pick<AppCommands, 'rulersVisible' | 'toggleRulers'> = { rulersVisible: visible, toggleRulers: toggle };
  return { commands, rulers, layer, snapSource };
}
