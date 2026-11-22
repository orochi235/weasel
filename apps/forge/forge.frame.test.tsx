import { cleanup, render, screen } from '@testing-library/react';
import type { StoryContext } from '@weasel-js/forge';
import { afterEach, describe, expect, it, vi } from 'vitest';
import setup from './forge.frame';

vi.mock('./DevtoolsDock', () => ({ default: () => null }));
afterEach(cleanup);

describe('the labkit frame decorator', () => {
  it('themes a labkit story by the Theme and Density globals, not by labkit’s own theme', async () => {
    const title = 'labkit/Controls/Thing';
    await setup.prepare?.({ title } as never);
    const ctx = { title, globals: { theme: 'win9x', density: 'compact', mode: 'dark' } } as unknown as StoryContext;
    const decorate = setup.decorators![0]!;
    render(<>{decorate(() => <p>the story</p>, ctx)}</>);
    const themed = screen.getByText('the story').closest('[data-wzl-theme]');
    expect(themed?.getAttribute('data-wzl-theme')).toBe('win9x');
    expect(themed?.getAttribute('data-wzl-density')).toBe('compact');
    expect(themed?.getAttribute('data-wzl-mode')).toBe('dark');
    expect(screen.getByText('the story').closest('.lk-root')).not.toBeNull();
  });
});
