import { always, never, PATH_DIRECTION_CHROME_ID, type VisibilityRules } from '@weasel-js/core';
import { useMemo } from 'react';
import type { AppCommands } from './appCommands';
import { usePref } from './prefs';

/**
 * Path edit's direction arrows, driven by the View preference: the chrome rule that shows or
 * hides them on the canvas, and the toggle the command bar fires.
 */
export function usePathDirection() {
  const [shown, setShown] = usePref('view.pathDirection');
  const chromeVisibility = useMemo<VisibilityRules>(
    () => ({ [PATH_DIRECTION_CHROME_ID]: shown ? always : never }),
    [shown],
  );
  const commands: Pick<AppCommands, 'pathDirection' | 'togglePathDirection'> = {
    pathDirection: shown,
    togglePathDirection: () => setShown(!shown),
  };
  return { commands, chromeVisibility };
}
