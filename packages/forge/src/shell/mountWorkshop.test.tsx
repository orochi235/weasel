import { createMemoryAdapter } from '@weasel-js/labkit';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IndexEntry } from '../story/types';
import { installResizeObserver } from './labHarness';
import { createRevision } from './loupe/captureContext';
import { joinRevisions, type MountedWorkshop, mountWorkshop } from './mountWorkshop';
import { createStoryChanges } from './storyChanges';

installResizeObserver();

const a: IndexEntry = { id: 'x--a', title: 'X', name: 'A', exportName: 'A', file: '/x.stories.tsx' };

describe('mountWorkshop', () => {
  it('renders into #root and takes a new index without a reload', async () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);
    let workshop: MountedWorkshop | undefined;
    act(() => {
      workshop = mountWorkshop({
        index: [],
        frameUrl: '/frame.html',
        stories: ['*.stories.tsx'],
        storage: createMemoryAdapter(),
      });
    });
    expect(root.querySelector('.fg-empty')?.textContent).toContain('*.stories.tsx');
    act(() => workshop?.setIndex([a]));
    await waitFor(() => expect(root.querySelector('iframe.fg-frame-view')?.getAttribute('src')).toBe('/frame.html#x--a'));
    expect(root.querySelector('.fg-empty')).toBeNull();
    act(() => workshop?.unmount());
    root.remove();
  });

  it('counts its own revision on top of one it is given, and is heard when either moves', () => {
    const own = createRevision();
    const given = createRevision();
    const joined = joinRevisions(own, given);
    const heard = vi.fn();
    const off = joined.subscribe(heard);
    given.bump();
    own.bump();
    expect(joined.get()).toBe(2);
    expect(heard).toHaveBeenCalledTimes(2);
    off();
    given.bump();
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('reloads through the changes it is given', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const changes = createStoryChanges();
    const revision = createRevision();
    const heard = vi.fn();
    const off = changes.subscribe(heard);
    let workshop: MountedWorkshop | undefined;
    act(() => {
      workshop = mountWorkshop({ container, index: [], frameUrl: '/frame.html', changes, revision, storage: createMemoryAdapter() });
    });
    act(() => workshop?.reloadStory('/x.stories.tsx'));
    expect(heard).toHaveBeenCalledWith('/x.stories.tsx');
    off();
    act(() => workshop?.unmount());
    container.remove();
  });
});
