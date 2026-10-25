import { createMemoryAdapter } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { meta, story } from '../story/define';
import type { IndexEntry } from '../story/types';
import { installResizeObserver } from './labHarness';
import { Workshop } from './Workshop';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

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
  return renderWithIcons(<Workshop index={[a, b]} frameUrl="/frame.html" importers={importers()} storage={createMemoryAdapter()} />);
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

  it('keeps the knobs of an open trial when its story is picked in the tree from a URL that names none', async () => {
    const storage = createMemoryAdapter();
    const workshop = () => <Workshop index={[a, b]} frameUrl="/frame.html" importers={importers()} storage={storage} />;
    history.replaceState(null, '', '/#/x--a');
    const first = renderWithIcons(workshop());
    await shows('hi/4/false');
    fireEvent.change(screen.getByRole('textbox', { name: 'Label' }), { target: { value: 'Save' } });
    await waitFor(() => expect(location.hash).toBe('#/x--a?label=Save'));
    // labkit saves a trial's config a moment after it changes.
    await waitFor(() => expect(JSON.stringify(storage.listSync?.(''))).toContain('Save'), { timeout: 5000 });
    first.unmount();

    history.replaceState(null, '', '/');
    renderWithIcons(workshop());
    await shows('Save/4/false');
    fireEvent.click(screen.getByRole('radio', { name: 'Tree' }));
    const folder = screen.getByRole('treeitem', { name: 'X' });
    // The fold mark: the folder's own row would open its index page in the trial.
    if (folder.getAttribute('aria-expanded') !== 'true') fireEvent.click(folder.querySelector('[data-tree-twisty]')!);
    // Picking an open story scrolls its trial into view, which jsdom has no method for.
    const proto = Element.prototype as { scrollIntoView?: () => void };
    proto.scrollIntoView = () => {};
    try {
      fireEvent.click(within(screen.getByRole('treeitem', { name: 'A' })).getByText('A'));
      await waitFor(() => expect(location.hash).toBe('#/x--a?label=Save'));
      await shows('Save/4/false');
    } finally {
      delete proto.scrollIntoView;
    }
  });

  it('keeps a restored trial’s knobs when its story is picked in the tree before its module has loaded', async () => {
    const storage = createMemoryAdapter();
    history.replaceState(null, '', '/#/x--a');
    const first = renderWithIcons(<Workshop index={[a, b]} frameUrl="/frame.html" importers={importers()} storage={storage} />);
    await shows('hi/4/false');
    fireEvent.change(screen.getByRole('textbox', { name: 'Label' }), { target: { value: 'Save' } });
    await waitFor(() => expect(JSON.stringify(storage.listSync?.(''))).toContain('Save'), { timeout: 5000 });
    first.unmount();

    history.replaceState(null, '', '/');
    let load = (): void => {};
    const pending = new Promise<Record<string, unknown>>((resolve) => {
      load = () => resolve(xModule as unknown as Record<string, unknown>);
    });
    renderWithIcons(<Workshop index={[a, b]} frameUrl="/frame.html" importers={{ '/x.stories.tsx': () => pending }} storage={storage} />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Tree' }, { timeout: 5000 }));
    const folder = screen.getByRole('treeitem', { name: 'X' });
    if (folder.getAttribute('aria-expanded') !== 'true') fireEvent.click(folder.querySelector('[data-tree-twisty]')!);
    const proto = Element.prototype as { scrollIntoView?: () => void };
    proto.scrollIntoView = () => {};
    try {
      fireEvent.click(within(screen.getByRole('treeitem', { name: 'A' })).getByText('A'));
      expect(screen.queryByTestId('story')).toBeNull();
      await act(async () => {
        load();
        await pending;
      });
      await waitFor(() => expect(location.hash).toBe('#/x--a?label=Save'), { timeout: 5000 });
      await shows('Save/4/false');
    } finally {
      delete proto.scrollIntoView;
    }
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
