import { TrialIdContext, useLabContext } from '@weasel-js/labkit';
import { useContext } from 'react';
import type { FrameSetup } from '../frame/FrameController';
import { type IndexEnv, IndexPage } from '../frame/index/IndexPage';
import type { Globals } from '../protocol/messages';
import type { IndexRender, LoadedStory } from '../story/types';
import { TrialHost } from './TrialHost';
import { setRoute } from './useRoute';

/** A component's index page as the registry loads it: its stories in index order, and the page's own render. */
export interface IndexBundle {
  title: string;
  description?: string;
  stories: readonly LoadedStory[];
  descriptions: Readonly<Record<string, string>>;
  render: IndexRender | null;
}

export interface IndexTrialProps {
  bundle: IndexBundle;
  setup: FrameSetup;
  config: unknown;
}

/** A component's index page rendered in the workshop document; `open` swaps its own trial to the story clicked. */
export function IndexTrial({ bundle, setup, config }: IndexTrialProps) {
  const lab = useLabContext();
  const trialId = useContext(TrialIdContext);
  const open = (id: string) => {
    if (!trialId || !lab.instruments.some((instrument) => instrument.name === id)) return;
    lab.swapTrial(trialId, id);
    setRoute(id, { inPlace: true });
  };
  const render = (globals: Globals) => {
    const env: IndexEnv = {
      title: bundle.title,
      ...(bundle.description === undefined ? {} : { description: bundle.description }),
      stories: bundle.stories,
      descriptions: bundle.descriptions,
      globals,
      decorators: setup.decorators ?? [],
      open,
      // A story that throws shows its error in its own cell; the rest of the page is still worth reading.
      onError: (error) => console.error(error),
    };
    return <IndexPage env={env} render={bundle.render} />;
  };
  return (
    <TrialHost layout="fullscreen" setup={setup} config={config}>
      {render}
    </TrialHost>
  );
}
