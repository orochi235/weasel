import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FrameImporters } from '../frame/mountFrame';
import { followEdits, type HotEvents } from './followEdits';
import { createRevision } from './loupe/captureContext';
import { endpoint, hosts, payload, request, settle, shown, stubBitmaps } from './loupe/pixels.fixture';
import { createPixelsSource, RECAPTURE_DEBOUNCE_MS } from './loupe/pixelsSource';
import type { MountedWorkshop } from './mountWorkshop';

/** vite's `import.meta.hot`, as far as the workshop listens: the test emits what the plugin would push. */
function hot() {
  const listeners = new Map<string, ((data: never) => void)[]>();
  const events: HotEvents = {
    on: (event, listener) => void listeners.set(event, [...(listeners.get(event) ?? []), listener]),
  };
  const emit = (event: string, data?: unknown) => {
    for (const listener of listeners.get(event) ?? []) listener(data as never);
  };
  return { events, emit };
}

function workshop(revise: () => void = () => {}) {
  return {
    setIndex: vi.fn(),
    setImporters: vi.fn(),
    reloadStory: vi.fn(),
    setDependencies: vi.fn(),
    revise: vi.fn(revise),
    unmount: vi.fn(),
  } satisfies MountedWorkshop;
}

beforeEach(stubBitmaps);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('followEdits', () => {
  it('reloads each edited story once the importers that fetch it arrive', () => {
    const { events, emit } = hot();
    const w = workshop();
    const edits = followEdits(events, w);
    emit('forge:story', { file: '/a.stories.tsx' });
    emit('forge:story', { file: '/b.stories.tsx' });
    expect(w.reloadStory).not.toHaveBeenCalled();
    const next = {} as FrameImporters;
    edits.importers(next);
    expect(w.setImporters).toHaveBeenCalledWith(next);
    expect(w.reloadStory.mock.calls).toEqual([['/a.stories.tsx'], ['/b.stories.tsx']]);
    edits.importers(next);
    expect(w.reloadStory).toHaveBeenCalledTimes(2);
  });

  it('marks every capture stale on a stylesheet-only update', async () => {
    vi.useFakeTimers();
    hosts();
    const { fetch, posts } = endpoint();
    const revision = createRevision();
    const source = createPixelsSource({
      base: '/',
      payloadFor: () => payload('story-a'),
      fetch,
      revision: revision.get,
      subscribeRevision: revision.subscribe,
    });
    const { events, emit } = hot();
    followEdits(events, workshop(revision.bump));
    const slot = document.createElement('div');
    const handle = source.attach(slot, request(50));
    await vi.advanceTimersByTimeAsync(0);
    posts[0]!.answer();
    await settle();
    expect(shown(slot)).toBe(true);

    emit('vite:beforeUpdate', { type: 'update', updates: [{ type: 'css-update', path: '/src/button.css', acceptedPath: '/src/button.css', timestamp: 1 }] });
    expect(shown(slot)).toBe(false);
    await vi.advanceTimersByTimeAsync(RECAPTURE_DEBOUNCE_MS);
    expect(posts).toHaveLength(2);
    handle.detach();
  });
});
