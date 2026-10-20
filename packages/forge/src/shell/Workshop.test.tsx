import { createMemoryAdapter } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { describeSchema } from '../protocol/schema';
import type { IndexEntry } from '../story/types';
import { connectFrame, flush, installResizeObserver } from './labHarness';
import { Workshop } from './Workshop';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

/** The row's own control rather than the label beside it, which is a button too
 *  — it toggles auto — and is named `Pin <label>`; a bare `/Mode/` matches both. */
const notTheAutoToggle = (label: string) => (name: string) =>
  name.includes(label) && !name.startsWith('Pin ');

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
    const { container } = renderWithIcons(
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

  it("labels a story's package from the shell config's libraries, and by its title with none", async () => {
    const file = '/repo/packages/ui/src/X.stories.tsx';
    const index = [{ ...a, file }];
    const labels = async () => {
      const packages = await screen.findByRole('group', { name: 'Packages' });
      return Array.from(packages.querySelectorAll('.fg-tree__tag'), (tag) => tag.textContent);
    };
    const bare = renderWithIcons(<Workshop index={index} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    expect(await labels()).toEqual(['X']);
    bare.unmount();
    renderWithIcons(
      <Workshop
        index={index}
        frameUrl="/frame.html"
        storage={createMemoryAdapter()}
        config={{ libraries: [{ path: '/packages/ui/', label: 'kit' }] }}
      />,
    );
    expect(await labels()).toEqual(['kit']);
  });

  it('opens the story the hash names', async () => {
    location.hash = '#/x--b';
    const { container } = renderWithIcons(<Workshop index={[a, b]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    expect(await frameSrc(container)).toBe('/frame.html#x--b');
  });

  it('shows a story the hash comes to name in the focused trial rather than a new one, and leaves out the add-trial picker', async () => {
    location.hash = '#/x--a';
    const { container } = renderWithIcons(<Workshop index={[a, b]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    await waitFor(() => expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(1));
    expect(screen.getByRole('region', { name: 'Trial X > A' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add trial/i })).toBeNull();
    act(() => {
      location.hash = '#/x--b';
    });
    await waitFor(() => expect(screen.getByRole('region', { name: 'Trial X > B' })).toBeInTheDocument());
    expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(1);
    expect(container.querySelector('[role="tree"]')).not.toBeNull();
  });

  it('says in the stage that the story the hash names does not exist, and shows a real one again when the hash names it', async () => {
    location.hash = '#/x--a';
    renderWithIcons(<Workshop index={[a, b]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    await waitFor(() => expect(screen.getByRole('region', { name: 'Trial X > A' })).toBeInTheDocument());
    act(() => {
      location.hash = '#/no-such--story';
    });
    const trial = await screen.findByRole('region', { name: 'Trial No story no-such--story' });
    expect(within(trial).getByRole('alert').textContent).toContain('no-such--story');
    expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(1);
    act(() => {
      location.hash = '#/x--b';
    });
    await waitFor(() => expect(screen.getByRole('region', { name: 'Trial X > B' })).toBeInTheDocument());
    expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(1);
  });

  it('opens exactly one trial of a story clicked in the tree', async () => {
    location.hash = '#/x--a';
    renderWithIcons(<Workshop index={[a, b]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    await waitFor(() => expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(1));
    fireEvent.click(screen.getByRole('radio', { name: 'Tree' }));
    const folder = screen.getByRole('treeitem', { name: 'X' });
    if (folder.getAttribute('aria-expanded') !== 'true') fireEvent.click(within(folder).getByText('X'));
    fireEvent.click(screen.getByRole('treeitem', { name: 'B' }));
    await waitFor(() => expect(location.hash).toBe('#/x--b'));
    await act(async () => {});
    expect(screen.getAllByRole('region', { name: 'Trial X > B' })).toHaveLength(1);
  });

  it('takes the trial back to the previous story on browser back, rather than opening another', async () => {
    location.hash = '#/x--a';
    renderWithIcons(<Workshop index={[a, b]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    await waitFor(() => expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(1));
    fireEvent.click(screen.getByRole('radio', { name: 'Tree' }));
    const folder = screen.getByRole('treeitem', { name: 'X' });
    if (folder.getAttribute('aria-expanded') !== 'true') fireEvent.click(within(folder).getByText('X'));
    fireEvent.click(screen.getByRole('treeitem', { name: 'B' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Trial X > B' })).toBeInTheDocument());
    act(() => history.back());
    await waitFor(() => expect(location.hash).toBe('#/x--a'));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Trial X > A' })).toBeInTheDocument());
    expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(1);
    act(() => history.forward());
    await waitFor(() => expect(screen.getByRole('region', { name: 'Trial X > B' })).toBeInTheDocument());
    expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(1);
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
    const { container } = renderWithIcons(
      <Workshop index={[a, b]} frameUrl="/frame.html" config={{ globals }} storage={createMemoryAdapter()} />,
    );
    await waitFor(() => expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(1));
    // Shift-click in the tree is what opens a second trial; a hash goes into the focused one.
    fireEvent.click(screen.getByRole('radio', { name: 'Tree' }));
    const folder = screen.getByRole('treeitem', { name: /^X/ });
    if (folder.getAttribute('aria-expanded') !== 'true') fireEvent.click(within(folder).getByText('X'));
    fireEvent.click(screen.getByRole('treeitem', { name: 'B' }), { shiftKey: true });
    await waitFor(() => expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(2));
    const frames = [...container.querySelectorAll<HTMLIFrameElement>('iframe.fg-frame-view')].map(connectFrame);
    expect(frames).toHaveLength(2);
    const ready = { type: 'ready', schema: describeSchema(f.schema({})), layout: 'centered', viewport: null } as const;
    for (const { frame } of frames) frame.send(ready);
    await flush();
    for (const { received } of frames) expect(received).toEqual([expect.objectContaining({ type: 'init', globals: { mode: 'auto' } })]);

    const trialB = screen.getByRole('region', { name: 'Trial X > B' });
    act(() => {
      fireEvent.click(within(trialB).getByRole('button', { name: notTheAutoToggle('Mode') }));
    });
    fireEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Dark' }));
    await flush();

    const toolbar = screen.getByRole('toolbar', { name: 'Globals' });
    act(() => {
      fireEvent.click(within(toolbar).getByRole('button', { name: notTheAutoToggle('Mode') }));
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

  it('opens a component’s index page the hash names', async () => {
    location.hash = '#/x:index';
    const { container } = renderWithIcons(<Workshop index={[a, b]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    expect(await frameSrc(container)).toBe('/frame.html#x:index');
    expect(screen.getByRole('region', { name: 'Trial X' })).toBeInTheDocument();
    act(() => {
      location.hash = '#/x--b';
    });
    await waitFor(() => expect(screen.getByRole('region', { name: 'Trial X > B' })).toBeInTheDocument());
    expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(1);
    act(() => {
      location.hash = '#/x:index';
    });
    await waitFor(() => expect(screen.getByRole('region', { name: 'Trial X' })).toBeInTheDocument());
    expect(screen.getAllByRole('region', { name: /^Trial / })).toHaveLength(1);
  });

  it('opens on the missing story, not the first one, when the hash names none that is indexed', async () => {
    location.hash = '#/nope';
    const { container } = renderWithIcons(<Workshop index={[a, b]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    const trial = await screen.findByRole('region', { name: 'Trial No story nope' });
    expect(within(trial).getByRole('alert').textContent).toContain('nope');
    expect(container.querySelector('iframe.fg-frame-view')).toBeNull();
  });

  it('keeps a story frame hidden until the frame reports its first render, so a new trial shows no blank page', async () => {
    location.hash = '#/x--a';
    const { container } = renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
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
    await flush();
    frame.close();
  });

  it('shows a frame that faults before it renders', async () => {
    location.hash = '#/x--a';
    const { container } = renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
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
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" config={{ pages, path: '/labs/forge' }} storage={createMemoryAdapter()} />);
    // The lab draws a fallback title while its store opens; the menu belongs to the mounted lab.
    await screen.findByRole('region', { name: /^Trial / });
    fireEvent.click(screen.getByRole('button', { name: 'weaselforge' }));
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(items.map((item) => [item.textContent, item.getAttribute('href')])).toEqual([
      ['weaselforge', '/labs/forge'],
      ['Palette lab', '/labs/palette'],
    ]);
    expect(items[0]).toHaveAttribute('aria-current', 'page');
  });

  it('is titled weaselforge, on the page and in the document, unless the config names it', async () => {
    location.hash = '#/x--a';
    const { unmount } = renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={createMemoryAdapter()} />);
    await screen.findByRole('region', { name: /^Trial / });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('weaselforge');
    expect(document.title).toBe('weaselforge');
    unmount();
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" config={{ title: 'astv parts' }} storage={createMemoryAdapter()} />);
    await screen.findByRole('region', { name: /^Trial / });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('astv parts');
    expect(document.title).toBe('astv parts');
  });

  it('hides the CSS Vars panel until its header toggle is pressed, and remembers the choice', async () => {
    location.hash = '#/x--a';
    const storage = createMemoryAdapter();
    const first = renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={storage} />);
    await screen.findByRole('region', { name: /^Trial / });
    const toggle = await screen.findByRole('button', { name: 'CSS Vars panel' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('region', { name: 'CSS Vars' })).toBeNull();

    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByRole('region', { name: 'CSS Vars' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'CSS Vars panel' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(JSON.stringify(storage.listSync?.(''))).toContain('fg-css-vars-shown'), { timeout: 5000 });
    first.unmount();

    history.replaceState(null, '', '/');
    location.hash = '#/x--a';
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" storage={storage} />);
    await waitFor(() => expect(screen.getByRole('region', { name: 'CSS Vars' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'CSS Vars panel' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers neither the CSS Vars panel nor its toggle when the config turns it off', async () => {
    location.hash = '#/x--a';
    renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" config={{ cssVars: false }} storage={createMemoryAdapter()} />);
    await screen.findByRole('region', { name: /^Trial / });
    expect(screen.queryByRole('region', { name: 'CSS Vars' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'CSS Vars panel' })).toBeNull();
  });
});
