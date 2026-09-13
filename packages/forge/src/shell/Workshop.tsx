import { Lab, type LabContribution, type StorageAdapter, useLabContext } from '@weasel-js/labkit';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ShellConfig } from '../config';
import type { Globals } from '../protocol/messages';
import type { IndexEntry } from '../story/types';
import { CSS_VARS_SECTION } from './cssVars/CssVarsPanel';
import { createTrialFrames, TrialFramesContext } from './cssVars/trialFrames';
import { StoryGlobalsContext } from './StoryGlobalsContext';
import { StoryTree } from './tree/StoryTree';
import { readRoute, useRoute } from './useRoute';
import { useStoryRegistry } from './useStoryRegistry';

export interface WorkshopProps {
  index: readonly IndexEntry[];
  frameUrl: string;
  config?: ShellConfig;
  /** The story globs the index was built from, named when it is empty. */
  stories?: readonly string[];
  storageKey?: string;
  storage?: StorageAdapter;
}

const NO_GLOBALS: Globals = {};
const TRIAL_CHROME = [CSS_VARS_SECTION];

/** The story `#/<id>` names, when it is indexed; otherwise the first story. Read when the lab mounts. */
function initialStory(index: readonly IndexEntry[], fallback: string): string {
  const route = readRoute();
  return route !== null && index.some((entry) => entry.id === route) ? route : fallback;
}

/** Opens a trial of the story the route names when none is open, once per route, so closing that trial sticks. */
function RouteOpener({ index }: { index: readonly IndexEntry[] }) {
  const lab = useLabContext();
  const [route] = useRoute();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (route === null || handled.current === route || !index.some((entry) => entry.id === route)) return;
    handled.current = route;
    if (!lab.trials.some((trial) => trial.instrumentName === route)) lab.addTrial(route);
  }, [route, index, lab]);
  return null;
}

export function Workshop({ index, frameUrl, config, stories = [], storageKey, storage }: WorkshopProps) {
  const registry = useStoryRegistry(index, { frameUrl });
  const [frames] = useState(createTrialFrames);
  const shell = config;
  const labChrome = useMemo<readonly LabContribution[]>(
    () => [
      { id: 'fg-stories', region: 'sidebar', render: (ctx) => <StoryTree ctx={ctx} index={index} /> },
      ...(shell?.labChrome ?? []),
    ],
    [index, shell?.labChrome],
  );
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
  return (
    <StoryGlobalsContext.Provider value={NO_GLOBALS}>
      <TrialFramesContext.Provider value={frames}>
        <Lab
          title="weaselforge"
          instruments={registry.instruments}
          defaultInstrument={initialStory(index, first.id)}
          storageKey={storageKey ?? 'weaselforge'}
          {...(storage ? { storage } : {})}
          labChrome={labChrome}
          chrome={TRIAL_CHROME}
          addTrial={false}
          {...(shell?.controls ? { controls: shell.controls } : {})}
        >
          <RouteOpener index={index} />
        </Lab>
      </TrialFramesContext.Provider>
    </StoryGlobalsContext.Provider>
  );
}
