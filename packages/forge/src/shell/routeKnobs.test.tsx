import { createMemoryAdapter } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { meta, story } from '../story/define';
import type { IndexEntry } from '../story/types';
import { installResizeObserver } from './labHarness';
import { Workshop } from './Workshop';

installResizeObserver();

const a: IndexEntry = { id: 'x--a', title: 'X', name: 'A', exportName: 'A', file: '/x.stories.tsx' };
const b: IndexEntry = { id: 'x--b', title: 'X', name: 'B', exportName: 'B', file: '/x.stories.tsx' };

const xModule = {
  default: meta({ title: 'X' }),
  A: story({
    config: f.schema({ label: f.string('hi'), look: f.group({ px: f.number(4), round: f.boolean(false) }) }),
    render: ({ config }) => (
      <output data-testid="story">
        {config.label}/{config.look.px}/{String(config.look.round)}
      </output>
    ),
  }),
  B: story({ config: f.schema({ count: f.number(1) }), render: ({ config }) => <output data-testid="story">B{config.count}</output> }),
};

const importers = () => ({ '/x.stories.tsx': vi.fn(() => Promise.resolve(xModule as unknown as Record<string, unknown>)) });

function mount(hash: string) {
  history.replaceState(null, '', `/${hash}`);
  return render(<Workshop index={[a, b]} frameUrl="/frame.html" importers={importers()} storage={createMemoryAdapter()} />);
}

/** The story's text, once its module has loaded; the first load in a jsdom realm takes over a second. */
const shows = (text: string) =>
  waitFor(() => expect(screen.getByTestId('story').textContent).toBe(text), { timeout: 5000 });

afterEach(() => {
  history.replaceState(null, '', '/');
});

describe('knobs in the URL', () => {
  it('opens a story at the knob values its URL names, grouped ones by dotted path', async () => {
    mount('#/x--a?label=Go&look.px=8&look.round=true');
    await shows('Go/8/true');
  });

  it('ignores a knob that does not parse or names no arg, and drops it from the URL', async () => {
    mount('#/x--a?label=Go&look.px=wide&nope=1');
    await shows('Go/4/false');
    await waitFor(() => expect(location.hash).toBe('#/x--a?label=Go'));
  });

  it('writes a changed knob back to the URL in place, and drops one returned to its default', async () => {
    mount('#/x--a');
    await shows('hi/4/false');
    const entries = history.length;
    const label = screen.getByRole('textbox', { name: 'Label' });
    fireEvent.change(label, { target: { value: 'Save' } });
    await waitFor(() => expect(location.hash).toBe('#/x--a?label=Save'));
    fireEvent.change(label, { target: { value: 'hi' } });
    await waitFor(() => expect(location.hash).toBe('#/x--a'));
    expect(history.length).toBe(entries);
  });

  it('keeps the reserved t param when it rewrites the knobs, and never reads t as a knob', async () => {
    mount('#/x--a?t=2.5&label=Go');
    await shows('Go/4/false');
    fireEvent.change(screen.getByRole('textbox', { name: 'Label' }), { target: { value: 'Stop' } });
    await waitFor(() => expect(location.hash).toBe('#/x--a?label=Stop&t=2.5'));
  });

  it('drops the previous story’s knobs when the route moves to another story', async () => {
    mount('#/x--a?label=Go');
    await shows('Go/4/false');
    act(() => {
      location.hash = '#/x--b';
    });
    await shows('B1');
    expect(location.hash).toBe('#/x--b');
  });

  it('applies knobs typed into the URL of the story already open', async () => {
    mount('#/x--a');
    await shows('hi/4/false');
    act(() => {
      location.hash = '#/x--a?look.px=12';
    });
    await shows('hi/12/false');
  });
});
