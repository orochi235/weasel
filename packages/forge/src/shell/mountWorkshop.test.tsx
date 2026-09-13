import { createMemoryAdapter } from '@weasel-js/labkit';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { IndexEntry } from '../story/types';
import { installResizeObserver } from './labHarness';
import { type MountedWorkshop, mountWorkshop } from './mountWorkshop';

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
});
