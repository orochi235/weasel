// The render worker `workerRender.browser.test.tsx` starts: the two lines a consumer's own is,
// plus one animation program the page plays by key.
import { tweenVertexColors } from '@weasel-js/animator';
import { serveSceneRender } from '@weasel-js/core/render-worker';

const RED = [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1];
const BLUE = [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1];

serveSceneRender({
  animations: {
    'red-to-blue': ({ animator, params }) => tweenVertexColors(animator, {
      id: (params as { id: string }).id, channel: 'fill', from: RED, to: BLUE, ms: 1000, easing: 'linear',
    }),
  },
});
