import { Lab } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, describe, expect, it } from 'vitest';
import type { FromFrame } from '../protocol/messages';
import { describeSchema } from '../protocol/schema';
import type { IndexEntry } from '../story/types';
import { connectFrame, flush, installResizeObserver } from './labHarness';
import { StoryGlobalsContext } from './StoryGlobalsContext';
import { useStoryRegistry } from './useStoryRegistry';

installResizeObserver();

// No viewport: the index could not read one, so the stage arrives with the frame's `ready`.
const entry: IndexEntry = { id: 't--sized', title: 'T', name: 'Sized', exportName: 'Sized', file: '/t.stories.tsx' };
const ready: Extract<FromFrame, { type: 'ready' }> = {
  type: 'ready',
  schema: describeSchema(f.schema({ label: f.string('clicks') })),
  layout: 'centered',
  viewport: { width: 320, height: 200 },
};

function RegistryLab() {
  const registry = useStoryRegistry([entry], { frameUrl: '/frame.html' });
  return (
    <StoryGlobalsContext.Provider value={{}}>
      <Lab instruments={registry.instruments} defaultInstrument={entry.id} />
    </StoryGlobalsContext.Provider>
  );
}

const proto = Element.prototype as Element & { moveBefore?: (node: Node, child: Node | null) => void };
const frames = (root: ParentNode) => [...root.querySelectorAll<HTMLIFrameElement>('iframe.fg-frame-view')];

describe('a story frame whose ready brings a viewport the index did not read', () => {
  afterEach(() => {
    Reflect.deleteProperty(proto, 'moveBefore');
  });

  // jsdom reloads no document, so these assert the proxy: the element and its port are the ones the story loaded in.
  it('moves into the stage as the same iframe on the same port, where the browser can move one', async () => {
    const moved: Node[] = [];
    proto.moveBefore = function (this: Element, node, child) {
      // A real moveBefore throws on a node that has left the document, which is what a late rescue would hand it.
      if (!node.isConnected) throw new DOMException('node is not connected', 'HierarchyRequestError');
      moved.push(node);
      this.insertBefore(node, child);
    };
    const view = await renderSettled(<RegistryLab />);
    const [iframe] = frames(view.container);
    const { frame, received } = connectFrame(iframe as HTMLIFrameElement);
    frame.send(ready);
    await flush();

    expect(view.container.querySelector('.lk-stage')).not.toBeNull();
    expect(frames(view.container)).toHaveLength(1);
    expect(frames(view.container)[0]).toBe(iframe);
    expect(iframe?.closest('.lk-stage')).not.toBeNull();
    expect(moved).toContain(iframe);
    expect(received).toEqual([{ type: 'init', config: { label: 'clicks' }, state: null, globals: {} }]);
    expect(iframe?.hasAttribute('data-pending')).toBe(true);

    frame.send({ type: 'rendered' });
    await flush();
    expect(iframe?.hasAttribute('data-pending')).toBe(false);
    frame.send({ type: 'setState', state: { n: 1 } });
    await flush();
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    frame.close();
  });

  it('loads a new iframe where the browser cannot', async () => {
    const view = await renderSettled(<RegistryLab />);
    const [iframe] = frames(view.container);
    const { frame } = connectFrame(iframe as HTMLIFrameElement);
    frame.send(ready);
    await flush();
    const [next] = frames(view.container);
    expect(next).not.toBe(iframe);
    expect(next?.closest('.lk-stage')).not.toBeNull();
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    frame.close();
  });
});
