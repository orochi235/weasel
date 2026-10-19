import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { StoryContext } from '@weasel-js/forge';
import { DEVTOOLS_GLOBALS, devtoolsDock } from './devtools';

afterEach(cleanup);

const ctx = (devtools: string) => ({ globals: { devtools } }) as unknown as StoryContext;

describe('the devtools decorator', () => {
  it('declares a Devtools global in a development build, off by default', () => {
    expect(DEVTOOLS_GLOBALS).toMatchObject({ devtools: { label: 'Devtools', default: 'off' } });
  });

  it('puts the panel beside the story only while the global is on, keeping the story mounted', { timeout: 15_000 }, async () => {
    const story = () => <p>the story</p>;
    const view = render(<>{devtoolsDock(story, ctx('off'))}</>);
    const shown = screen.getByText('the story');
    expect(screen.queryByRole('region', { name: 'Devtools' })).toBeNull();
    view.rerender(<>{devtoolsDock(story, ctx('on'))}</>);
    // The panel is a lazy chunk, and its first load transforms the whole package.
    expect(await screen.findByRole('region', { name: 'Devtools' }, { timeout: 10_000 })).toBeTruthy();
    expect(screen.getByText('the story')).toBe(shown);
  });
});
