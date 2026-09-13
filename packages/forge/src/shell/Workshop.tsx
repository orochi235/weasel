import { Lab, type StorageAdapter } from '@weasel-js/labkit';
import type { ForgeConfig } from '../config';
import type { Globals } from '../protocol/messages';
import type { IndexEntry } from '../story/types';
import { StoryGlobalsContext } from './StoryGlobalsContext';
import { useStoryRegistry } from './useStoryRegistry';

export interface WorkshopProps {
  index: readonly IndexEntry[];
  frameUrl: string;
  config?: ForgeConfig;
  /** The story globs the index was built from, named when it is empty. */
  stories?: readonly string[];
  storageKey?: string;
  storage?: StorageAdapter;
}

const NO_GLOBALS: Globals = {};

/** The story `#/<id>` names, when it is indexed; otherwise the first story. Read when the lab mounts. */
function initialStory(index: readonly IndexEntry[], fallback: string): string {
  const hashed = location.hash.startsWith('#/') ? decodeURIComponent(location.hash.slice(2)) : '';
  return index.some((entry) => entry.id === hashed) ? hashed : fallback;
}

export function Workshop({ index, frameUrl, config, stories = [], storageKey, storage }: WorkshopProps) {
  const registry = useStoryRegistry(index, { frameUrl });
  const first = index[0];
  if (!first) {
    return (
      <div className="fg-empty">
        <p className="fg-empty__title">No stories found</p>
        {stories.length > 0 ? (
          <ul className="fg-empty__globs" aria-label="Story globs">
            {stories.map((glob) => (
              <li key={glob}>
                <code>{glob}</code>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  const shell = config?.shell;
  return (
    <StoryGlobalsContext.Provider value={NO_GLOBALS}>
      <Lab
        title="weaselforge"
        instruments={registry.instruments}
        defaultInstrument={initialStory(index, first.id)}
        storageKey={storageKey ?? 'weaselforge'}
        {...(storage ? { storage } : {})}
        {...(shell?.labChrome ? { labChrome: shell.labChrome } : {})}
        {...(shell?.controls ? { controls: shell.controls } : {})}
      />
    </StoryGlobalsContext.Provider>
  );
}
