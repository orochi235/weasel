import { createContext, useContext, type ReactNode } from 'react';
import type { PrefsSource as Source } from '@weasel-js/prefs';

const SourceContext = createContext<Source | null>(null);

/** Hands `source` (`PrefsSource` in `@weasel-js/prefs`) to every leaf drawn inside. */
export function PrefsSource({ source, children }: { source: Source; children?: ReactNode }) {
  return <SourceContext.Provider value={source}>{children}</SourceContext.Provider>;
}

/** The source of the params surface this is drawn in. */
export function usePrefsSource(): Source {
  const source = useContext(SourceContext);
  if (source === null) throw new Error('usePrefsSource: no <PrefsSource> above this component');
  return source;
}
