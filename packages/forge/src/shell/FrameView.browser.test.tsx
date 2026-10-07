import '../../../../apps/forge/labkitStyles';
import './shell.css';
import { Lab, LabContext, type LabContextValue } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { FromFrame } from '../protocol/messages';
import { describeSchema } from '../protocol/schema';
import type { IndexEntry } from '../story/types';
import { createAnswerBook } from './answers';
import { connectFrame, flush } from './labHarness';
import { StoryGlobalsContext } from './StoryGlobalsContext';
import { storyInstrument } from './storyInstrument';

// The stubbed-observer test in storyInstrument.test.tsx proves the reload; this one proves a real scroll triggers it.

afterEach(() => {
  cleanup();
  window.scrollTo(0, 0);
});

const entry: IndexEntry = { id: 't--far', title: 'T', name: 'Far', exportName: 'Far', file: '/t.stories.tsx' };
const ready: Extract<FromFrame, { type: 'ready' }> = {
  type: 'ready',
  schema: describeSchema(f.schema({ label: f.string('clicks') })),
  layout: 'centered',
  viewport: null,
};
const SPACER = 4000;

test('a trial scrolled far out of view drops its frame, and on return reloads it with its config and state', async () => {
  await page.viewport(1000, 700);
  let lab: LabContextValue | null = null;
  // about:blank stands in for the frame document: the test plays its half of the protocol.
  const instrument = storyInstrument({ entry, ready, answers: createAnswerBook(), frameUrl: 'about:blank', onReady: () => {} });
  render(
    <StoryGlobalsContext.Provider value={{}}>
      <div style={{ height: SPACER }} />
      <div style={{ width: 900, height: 600 }}>
        <Lab instruments={[instrument]} defaultInstrument={entry.id}>
          <LabContext.Consumer>
            {(value) => {
              lab = value;
              return null;
            }}
          </LabContext.Consumer>
        </Lab>
      </div>
    </StoryGlobalsContext.Provider>,
  );
  window.scrollTo(0, SPACER);
  const frames = () => document.querySelectorAll('iframe.fg-frame-view');
  await expect.poll(() => frames().length).toBe(1);
  const first = connectFrame(frames()[0] as HTMLIFrameElement);
  first.frame.send(ready);
  await flush();
  first.frame.send({ type: 'setConfig', path: 'label', value: 'renamed' });
  first.frame.send({ type: 'setState', state: { n: 3 } });
  await flush();
  expect(lab!.trials[0]?.state).toEqual({ n: 3 });

  window.scrollTo(0, 0);
  await expect.poll(() => frames().length).toBe(0);

  window.scrollTo(0, SPACER);
  await expect.poll(() => frames().length).toBe(1);
  const back = connectFrame(frames()[0] as HTMLIFrameElement);
  back.frame.send(ready);
  await flush();
  expect(back.received).toEqual([{ type: 'init', config: { label: 'renamed' }, state: { n: 3 }, globals: {} }]);
  first.frame.close();
  back.frame.close();
});
