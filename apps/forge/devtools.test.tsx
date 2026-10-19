import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StoryContext } from '@weasel-js/forge';
import { DEVTOOLS_GLOBALS, devtoolsDock } from './devtools';

// The panel has tests of its own; this one is about where the decorator puts it. Loading the real one here hung the
// forge project on a fleet node for over a minute, where the site project loads it in half a second.
vi.mock('./DevtoolsDock', () => ({ default: () => <section aria-label="Devtools" /> }));
afterEach(cleanup);

const ctx = (devtools: string) => ({ globals: { devtools } }) as unknown as StoryContext;

describe('the devtools decorator', () => {
  it('declares a Devtools global in a development build, off by default', () => {
    expect(DEVTOOLS_GLOBALS).toMatchObject({ devtools: { label: 'Devtools', default: 'off' } });
  });

  it('puts the panel beside the story only while the global is on, keeping the story mounted', async () => {
    const story = () => <p>the story</p>;
    const view = render(<>{devtoolsDock(story, ctx('off'))}</>);
    const shown = screen.getByText('the story');
    expect(screen.queryByRole('region', { name: 'Devtools' })).toBeNull();
    view.rerender(<>{devtoolsDock(story, ctx('on'))}</>);
    expect(await screen.findByRole('region', { name: 'Devtools' })).toBeTruthy();
    expect(screen.getByText('the story')).toBe(shown);
  });
});
