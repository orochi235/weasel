import { type InstrumentList, TrialIdContext, useLabContext, useTrialState } from '@weasel-js/labkit';
import { type ConfigSchema, valueAtPath } from '@weasel-js/labkit/config';
import { useEffect, useRef, useState } from 'react';
import { knobPaths, knobsToParams, paramsToKnobs, reservedParams, sameKnob } from '../route/url';
import { routedTrial } from './routedTrial';
import { readRouteParams, replaceRouteParams, useRoute } from './useRoute';

interface KnobSyncProps {
  schema: ConfigSchema<unknown>;
  config: unknown;
}

/**
 * Keeps one trial's knobs and the URL in step. On mount, and whenever the hash changes under it, the URL's knobs are
 * written over the trial's config, with every leaf the URL could name and does not set returned to its default; after
 * that each change to the config is written back to the URL in place.
 */
function KnobSync({ schema, config }: KnobSyncProps) {
  const { setConfig } = useTrialState();
  const reading = useRef(true);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    const onHashChange = (): void => {
      reading.current = true;
      setTyped((n) => n + 1);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (reading.current) {
      reading.current = false;
      const knobs = paramsToKnobs(schema, readRouteParams());
      let wrote = false;
      for (const { path, leaf } of knobPaths(schema)) {
        const target = path in knobs ? knobs[path] : leaf.default;
        const current = valueAtPath(config, path);
        if (sameKnob(current === undefined ? leaf.default : current, target)) continue;
        setConfig(path as never, target as never);
        wrote = true;
      }
      // The write comes back as a config change, which runs this again to put it in the URL.
      if (wrote) return;
    }
    const knobs = knobsToParams(schema, config);
    replaceRouteParams((params) => ({ ...knobs, ...reservedParams(params) }));
  }, [schema, config, setConfig, typed]);

  return null;
}

/**
 * Ties the knobs of the trial showing the routed story to the URL's params: the focused trial when it shows that
 * story, else the first that does. Waits for the story's schema, since a provisional instrument has no leaves to
 * read the URL against and would otherwise wipe its knobs.
 */
export function RouteKnobs({ instruments, isReady }: { instruments: InstrumentList; isReady: (id: string) => boolean }) {
  const lab = useLabContext();
  const [route] = useRoute();
  if (route === null || !isReady(route)) return null;
  const trial = routedTrial(lab.trials, lab.focusedTrialId, route);
  const schema = instruments.find((instrument) => instrument.name === route)?.config;
  if (!trial || !schema) return null;
  return (
    <TrialIdContext.Provider value={trial.id}>
      <KnobSync key={`${trial.id} ${route}`} schema={schema as ConfigSchema<unknown>} config={trial.config} />
    </TrialIdContext.Provider>
  );
}
