import { createMemoryAdapter } from '@weasel-js/labkit';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { IndexEntry } from '../story/types';
import { installResizeObserver } from './labHarness';
import { Workshop } from './Workshop';

installResizeObserver();

const a: IndexEntry = { id: 'x--a', title: 'X', name: 'A', exportName: 'A', file: '/x.stories.tsx' };
const b: IndexEntry = { id: 'x--b', title: 'X', name: 'B', exportName: 'B', file: '/x.stories.tsx' };

async function frameSrc(container: HTMLElement): Promise<string | null> {
  await waitFor(() => expect(container.querySelector('iframe.fg-frame-view')).not.toBeNull());
  return container.querySelector('iframe.fg-frame-view')?.getAttribute('src') ?? null;
}

afterEach(() => {
  history.replaceState(null, '', '/');
});

describe('Workshop', () => {
  it('names the configured globs instead of a lab when no story is indexed', () => {
    const { container } = render(
      <Workshop
        index={[]}
        frameUrl="/frame.html"
        stories={['apps/**/*.stories.tsx', 'src/**/*.stories.ts']}
        storage={createMemoryAdapter()}
      />,
    );
    const empty = container.querySelector('.fg-empty');
    expect(empty?.textContent).toContain('apps/**/*.stories.tsx');
    expect(empty?.textContent).toContain('src/**/*.stories.ts');
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('opens the story the hash names', async () => {
    location.hash = '#/x--b';
    const { container } = render(<Workshop index={[a, b]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    expect(await frameSrc(container)).toBe('/frame.html#x--b');
  });

  it('opens the first story when the hash names none that is indexed', async () => {
    location.hash = '#/nope';
    const { container } = render(<Workshop index={[a, b]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    expect(await frameSrc(container)).toBe('/frame.html#x--a');
  });
});
