import { createContext, useContext } from 'react';
import type { Globals } from '../../protocol/messages';
import type { ApiTable } from '../../story/api';
import type { ComponentDeps, Decorator, LoadedStory } from '../../story/types';

/** What every cell on an index page shares with the frame that hosts it. */
export interface IndexEnv {
  title: string;
  /** The package the component ships in. */
  library?: string;
  description?: string;
  stories: readonly LoadedStory[];
  /** Per story id, the JSDoc above its export. */
  descriptions: Readonly<Record<string, string>>;
  /** A catalog or showcase rather than one component: every story of it is tagged `gallery`. */
  gallery?: boolean;
  /** The ids of the stories tagged `gallery`. */
  galleries?: readonly string[];
  /** The ids of the stories tagged `lab`: whole screens, which the page links to but does not embed. */
  labs?: readonly string[];
  /** The component's place in the component graph; absent until the graph arrives, and for a gallery. */
  dependencies?: ComponentDeps;
  /** The component's props and ref: null where forge found no component, absent where it read none or for a gallery. */
  api?: ApiTable | null;
  globals: Globals;
  /** The frame config's, outermost. */
  decorators: readonly Decorator[];
  open: (id: string) => void;
  onError: (error: unknown) => void;
}

export const IndexEnvContext = createContext<IndexEnv | null>(null);

export function useEnv(): IndexEnv {
  const env = useContext(IndexEnvContext);
  if (!env) throw new Error('An index page part rendered outside its index page');
  return env;
}

