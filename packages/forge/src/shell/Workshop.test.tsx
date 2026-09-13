import { createMemoryAdapter } from '@weasel-js/labkit';
import { act, render, screen, waitFor } from '@testing-library/react';
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

  it('opens a trial of a story the hash comes to name, and leaves out the add-trial picker', async () => {
    location.hash = '#/x--a';
    const { container } = render(<Workshop index={[a, b]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    await waitFor(() => expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(1));
    expect(screen.getByRole('region', { name: 'Trial X / A' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add trial/i })).toBeNull();
    act(() => {
      location.hash = '#/x--b';
    });
    await waitFor(() => expect(screen.getByRole('region', { name: 'Trial X / B' })).toBeInTheDocument());
    expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(2);
    expect(container.querySelector('[role="tree"]')).not.toBeNull();
  });

  it('opens the first story when the hash names none that is indexed', async () => {
    location.hash = '#/nope';
    const { container } = render(<Workshop index={[a, b]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    expect(await frameSrc(container)).toBe('/frame.html#x--a');
  });
});
