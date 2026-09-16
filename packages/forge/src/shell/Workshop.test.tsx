import { createMemoryAdapter } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { describeSchema } from '../protocol/schema';
import type { IndexEntry } from '../story/types';
import { connectFrame, flush, installResizeObserver } from './labHarness';
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

  it('opens exactly one trial of a story clicked in the tree', async () => {
    location.hash = '#/x--a';
    render(<Workshop index={[a, b]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    await waitFor(() => expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(1));
    const folder = screen.getByRole('treeitem', { name: 'X' });
    if (folder.getAttribute('aria-expanded') !== 'true') fireEvent.click(within(folder).getByText('X'));
    fireEvent.click(screen.getByRole('treeitem', { name: 'B' }));
    await waitFor(() => expect(location.hash).toBe('#/x--b'));
    await act(async () => {});
    expect(screen.getAllByRole('region', { name: 'Trial X / B' })).toHaveLength(1);
  });

  it('gives a story trial with no viewport no status bar', async () => {
    location.hash = '#/x--a';
    render(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const trial = await screen.findByRole('region', { name: 'Trial X / A' });
    expect(trial.querySelector('.lk-status-bar')).toBeNull();
  });

  it('sends a lab-wide global chosen in the toolbar to every open frame, and keeps a trial’s pin over it', async () => {
    const globals = {
      mode: {
        label: 'Mode',
        default: 'auto',
        options: [
          { value: 'auto', label: 'Auto' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ],
      },
    };
    location.hash = '#/x--a';
    const { container } = render(
      <Workshop index={[a, b]} frameUrl="/frame.html" config={{ globals }} storage={createMemoryAdapter()} />,
    );
    await waitFor(() => expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(1));
    act(() => {
      location.hash = '#/x--b';
    });
    await waitFor(() => expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(2));
    const frames = [...container.querySelectorAll<HTMLIFrameElement>('iframe.fg-frame-view')].map(connectFrame);
    expect(frames).toHaveLength(2);
    const ready = { type: 'ready', schema: describeSchema(f.schema({})), layout: 'centered', viewport: null } as const;
    for (const { frame } of frames) frame.send(ready);
    await flush();
    for (const { received } of frames) expect(received).toEqual([expect.objectContaining({ type: 'init', globals: { mode: 'auto' } })]);

    const trialB = screen.getByRole('region', { name: 'Trial X / B' });
    act(() => {
      fireEvent.click(within(trialB).getByRole('button', { name: /Mode/ }));
    });
    fireEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Dark' }));
    await flush();

    const toolbar = screen.getByRole('toolbar', { name: 'Globals' });
    act(() => {
      fireEvent.click(within(toolbar).getByRole('button', { name: /Mode/ }));
    });
    fireEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Light' }));
    await flush();
    const byTrial = Object.fromEntries(
      frames.map(({ received }, i) => [container.querySelectorAll('iframe.fg-frame-view')[i]!.getAttribute('src'), received.at(-1)]),
    );
    expect(byTrial).toEqual({
      '/frame.html#x--a': { type: 'globals', globals: { mode: 'light' } },
      '/frame.html#x--b': { type: 'globals', globals: { mode: 'dark' } },
    });
    for (const { frame } of frames) frame.close();
  });

  it('opens the first story when the hash names none that is indexed', async () => {
    location.hash = '#/nope';
    const { container } = render(<Workshop index={[a, b]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    expect(await frameSrc(container)).toBe('/frame.html#x--a');
  });

  it('keeps a story frame hidden until the frame reports its first render, so a new trial shows no blank page', async () => {
    location.hash = '#/x--a';
    const { container } = render(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    await frameSrc(container);
    const iframe = container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement;
    expect(iframe).toHaveAttribute('data-pending');
    const { frame } = connectFrame(iframe);
    frame.send({ type: 'ready', schema: describeSchema(f.schema({})), layout: 'centered', viewport: null });
    await flush();
    expect(iframe).toHaveAttribute('data-pending');
    frame.send({ type: 'rendered' });
    await flush();
    expect(iframe).not.toHaveAttribute('data-pending');

    connectFrame(iframe);
    expect(iframe).toHaveAttribute('data-pending');
    frame.close();
  });

  it('shows a frame that faults before it renders', async () => {
    location.hash = '#/x--a';
    const { container } = render(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    await frameSrc(container);
    const iframe = container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement;
    const { frame } = connectFrame(iframe);
    frame.send({ type: 'fault', phase: 'import', message: 'no such module' });
    await flush();
    expect(iframe).not.toHaveAttribute('data-pending');
    frame.close();
  });

  it('offers the configured labs in its title menu, marking this one', async () => {
    location.hash = '#/x--a';
    const pages = [
      { href: '/labs/forge', label: 'weaselforge' },
      { href: '/labs/palette', label: 'Palette lab' },
    ];
    render(<Workshop index={[a]} frameUrl="/frame.html" config={{ pages, path: '/labs/forge' }} storage={createMemoryAdapter()} />);
    // The lab draws a fallback title while its store opens; the menu belongs to the mounted lab.
    await screen.findByRole('region', { name: /^Trial / });
    fireEvent.click(screen.getByRole('button', { name: 'weaselforge' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => [item.textContent, item.getAttribute('href')])).toEqual([
      ['weaselforge', '/labs/forge'],
      ['Palette lab', '/labs/palette'],
    ]);
    expect(items[0]).toHaveAttribute('aria-current', 'page');
  });
});
