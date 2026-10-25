import type { Globals } from '../../protocol/messages';
import type { IndexBundle } from '../../story/indexBundle';
import { isGallery } from '../../story/tags';
import type { Decorator, DepGraph } from '../../story/types';
import type { IndexEnv } from './IndexPage';

/** What an index page's document adds to its bundle. */
export interface IndexEnvInputs {
  /** The component graph, or null where it has not arrived or the document has none. */
  graph: DepGraph | null;
  globals: Globals;
  /** The frame config's, outermost. */
  decorators: readonly Decorator[];
  open: (id: string) => void;
}

/** What every cell of `bundle`'s page shares, in whichever document renders it. */
export function indexEnvOf(bundle: IndexBundle, { graph, globals, decorators, open }: IndexEnvInputs): IndexEnv {
  const gallery = isGallery(bundle);
  const dependencies = gallery ? undefined : graph?.[bundle.title];
  return {
    title: bundle.title,
    library: bundle.library,
    ...(bundle.description === undefined ? {} : { description: bundle.description }),
    stories: bundle.stories,
    descriptions: bundle.descriptions,
    gallery,
    galleries: bundle.galleries,
    labs: bundle.labs,
    ...(dependencies ? { dependencies } : {}),
    globals,
    decorators,
    open,
    // A story that throws shows its error in its own cell; the rest of the page is still worth reading.
    onError: (error) => console.error(error),
  };
}
