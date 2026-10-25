import { TrialIdContext, useLabContext } from '@weasel-js/labkit';
import { useContext } from 'react';
import type { FrameSetup } from '../frame/FrameController';
import { indexEnvOf } from '../frame/index/indexEnv';
import { IndexPage } from '../frame/index/IndexPage';
import type { Globals } from '../protocol/messages';
import type { IndexBundle } from '../story/indexBundle';
import { DependenciesContext } from './dependencies';
import { LiveCopies } from './loupe/LiveCopies';
import { TrialHost } from './TrialHost';
import { setRoute } from './useRoute';

export interface IndexTrialProps {
  bundle: IndexBundle;
  setup: FrameSetup;
  config: unknown;
}

/** A component's index page rendered in the workshop document; `open` swaps its own trial to the story clicked. */
export function IndexTrial({ bundle, setup, config }: IndexTrialProps) {
  const lab = useLabContext();
  const trialId = useContext(TrialIdContext);
  const graph = useContext(DependenciesContext);
  const open = (id: string) => {
    if (!trialId || !lab.instruments.some((instrument) => instrument.name === id)) return;
    lab.swapTrial(trialId, id);
    setRoute(id, { inPlace: true });
  };
  const render = (globals: Globals) => (
    <IndexPage env={indexEnvOf(bundle, { graph, globals, decorators: setup.decorators ?? [], open })} render={bundle.render} />
  );
  return (
    <>
      <TrialHost layout="fullscreen" setup={setup} config={config}>
        {render}
      </TrialHost>
      <LiveCopies trialId={trialId} layout="fullscreen" setup={setup} trialConfig={config}>
        {render}
      </LiveCopies>
    </>
  );
}
