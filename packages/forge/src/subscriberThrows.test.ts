import { afterEach, describe, expect, it, vi } from 'vitest';
import { openChannel, type PortLike } from './protocol/channel';
import { PROTOCOL_VERSION } from './protocol/messages';
import { createAnswerBook } from './shell/answers';
import { createStoryChanges } from './shell/storyChanges';
import { onRevealInTree, revealInTree } from './shell/treeReveal';
import { createTrialFrames } from './shell/trialFrames';

afterEach(() => vi.restoreAllMocks());

/** Subscribes one listener that throws and one after it, and says what `change` did to them. */
function afterAThrow(subscribe: (fn: () => void) => unknown, change: () => void) {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  const heard = vi.fn();
  const offs = [
    subscribe(() => {
      throw new Error('boom');
    }),
    subscribe(heard),
  ];
  expect(change).not.toThrow();
  expect(heard).toHaveBeenCalledTimes(1);
  expect(logged).toHaveBeenCalledTimes(1);
  for (const off of offs) (off as () => void)();
}

describe('a subscriber that throws does not stop the ones after it', () => {
  it('for a tree reveal', () => {
    afterAThrow(onRevealInTree, () => revealInTree('a/b'));
  });

  it('in the story changes', () => {
    const changes = createStoryChanges();
    afterAThrow(changes.subscribe, () => changes.emit('a.stories.tsx'));
  });

  it('in the trial frames', () => {
    const frames = createTrialFrames();
    afterAThrow(frames.subscribe, () => frames.connect('t', { send: () => {}, audit: async () => [] } as never));
  });

  it('in the answer book', () => {
    const book = createAnswerBook();
    const config = { n: 1 };
    book.hold(config);
    afterAThrow(book.subscribe, () => book.record({ configKey: JSON.stringify(config), hidden: ['a'], errors: {} } as never));
  });

  it('on a channel', () => {
    let deliver = (_event: MessageEvent): void => {};
    const port: PortLike = {
      postMessage: () => {},
      addEventListener: (_type, fn) => {
        deliver = fn;
      },
      removeEventListener: () => {},
      close: () => {},
    };
    const channel = openChannel<string, string>(port);
    afterAThrow(channel.on, () => deliver({ data: { v: PROTOCOL_VERSION, msg: 'hello' } } as MessageEvent));
  });
});
