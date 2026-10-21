import { type LabContribution, usePersistedState } from '@weasel-js/labkit';
import { useEffect, useMemo } from 'react';
import { icon } from '../../icons.gen';
import { CSS_VARS_SECTION } from './CssVarsPanel';
import { subscribeReveal } from './reveal';

const RECORD = 'fg-css-vars-shown';

/** The header's CSS Vars toggle, then the panel itself while the toggle is on. */
export function cssVarsChrome(shown: boolean, toggle: () => void): readonly LabContribution[] {
  return [
    {
      id: 'fg-css-vars-toggle',
      region: 'header',
      group: 'story',
      item: { icon: icon('ui:typeBraces'), label: 'CSS Vars panel', pressed: shown, onActivate: toggle },
    },
    ...(shown ? [CSS_VARS_SECTION] : []),
  ];
}

/**
 * Reports `cssVarsChrome` to `onChrome` as the lab's persisted choice changes; off until the toggle is first
 * pressed, or until a token is revealed. Renders nothing; mount it inside the lab, since the choice lives there.
 */
export function CssVarsChrome({ onChrome }: { onChrome: (chrome: readonly LabContribution[]) => void }) {
  const [shown, setShown] = usePersistedState<boolean>(RECORD, false, { scope: 'lab' });
  const chrome = useMemo(() => cssVarsChrome(shown, () => setShown((was) => !was)), [shown, setShown]);
  useEffect(() => onChrome(chrome), [chrome, onChrome]);
  useEffect(() => subscribeReveal(() => setShown(true)), [setShown]);
  return null;
}
