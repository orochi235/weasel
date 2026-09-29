import { createMemoryAdapter, type RenderContext } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { renderThenAbandon } from '@weasel-js/routing/testing/abandonRender';
import { useLayoutEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ShellConfig } from '../config';
import { meta, story } from '../story/define';
import { indexId } from '../story/indexPages';
import type { IndexEntry } from '../story/types';
import { FOLLOW_APP } from './globals';
import { installResizeObserver } from './labHarness';
import { type StoryRegistry, useStoryRegistry } from './useStoryRegistry';
import { Workshop } from './Workshop';

installResizeObserver();

const a: IndexEntry = { id: 'x--a', title: 'X', name: 'A', exportName: 'A', file: '/x.stories.tsx' };
const b: IndexEntry = { id: 'x--b', title: 'X', name: 'B', exportName: 'B', file: '/x.stories.tsx' };
const c: IndexEntry = { id: 'y--c', title: 'Y', name: 'C', exportName: 'C', file: '/y.stories.tsx', isolate: 'uses 100vh' };
const xIndex: IndexEntry = { id: indexId('X'), title: 'X', name: 'Index', exportName: '', file: '/x.stories.tsx' };

const xModule = {
  default: meta({ title: 'X' }),
  A: story({ config: f.schema({ label: f.string('hi') }), render: ({ config }) => <button type="button">{config.label}</button> }),
  B: story({ render: () => <p>B</p>, viewport: { width: 320, height: 480 } }),
};
const yModule = { default: meta({ title: 'Y' }), C: story({ render: () => <p>C</p> }) };

const ctx = { config: {}, state: null, setConfig: () => {}, setState: () => {} } as unknown as RenderContext<unknown, unknown>;

function importers() {
  return {
    '/x.stories.tsx': vi.fn(() => Promise.resolve(xModule as unknown as Record<string, unknown>)),
    '/y.stories.tsx': vi.fn(() => Promise.resolve(yModule as unknown as Record<string, unknown>)),
  };
}

describe('useStoryRegistry in the document', () => {
  it('builds a pending instrument, loads the file when a trial renders it, and settles every story of the file', async () => {
    const imports = importers();
    const prepare = vi.fn();
    const { result } = renderHook(() => useStoryRegistry([a, b], { frameUrl: '/frame.html', importers: imports, setup: { prepare } }));
    const [pendingA, pendingB] = result.current.instruments;
    expect(pendingA?.config?.defaults()).toEqual({});
    expect(result.current.isReady('x--a')).toBe(false);
    expect(imports['/x.stories.tsx']).not.toHaveBeenCalled();

    render(<>{pendingA!.render(ctx)}</>);
    await waitFor(() => expect(result.current.isReady('x--a')).toBe(true));
    expect(imports['/x.stories.tsx']).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledTimes(2);
    const [loadedA, loadedB] = result.current.instruments;
    expect(loadedA).not.toBe(pendingA);
    expect(loadedA?.config?.defaults()).toEqual({ label: 'hi' });
    expect(loadedB).not.toBe(pendingB);
    expect(result.current.isReady('x--b')).toBe(true);
    expect(loadedB?.stage?.size).toEqual({ width: 320, height: 480 });
  });

  it('loads through the committed importers, not an abandoned render\'s', async () => {
    const committed = importers();
    const abandoned = importers();
    let registry!: StoryRegistry;
    function Probe({ imports }: { imports: ReturnType<typeof importers> }): null {
      const r = useStoryRegistry([a, b], { frameUrl: '/frame.html', importers: imports });
      useLayoutEffect(() => { registry = r; });
      return null;
    }
    renderThenAbandon(committed, abandoned, (imports) => <Probe imports={imports} />);
    render(<>{registry.instruments[0]!.render(ctx)}</>);
    await waitFor(() => expect(committed['/x.stories.tsx']).toHaveBeenCalledTimes(1));
    expect(abandoned['/x.stories.tsx']).not.toHaveBeenCalled();
  });

  it('renders the fault in place of a story whose module fails to load', async () => {
    const imports = { '/x.stories.tsx': () => Promise.reject(new Error('syntax error in x')) };
    const { result } = renderHook(() => useStoryRegistry([a, b], { frameUrl: '/frame.html', importers: imports }));
    const { rerender } = render(<>{result.current.instruments[0]!.render(ctx)}</>);
    await waitFor(() => expect(result.current.instruments[0]).not.toBe(undefined));
    await waitFor(() => {
      rerender(<>{result.current.instruments[0]!.render(ctx)}</>);
      expect(screen.getByRole('alert').textContent).toContain('syntax error in x');
    });
    expect(result.current.isReady('x--a')).toBe(false);
    expect(screen.getByRole('alert').textContent).toContain('import');
  });

  it("loads a component's index page from its files", async () => {
    const imports = importers();
    const { result } = renderHook(() => useStoryRegistry([a, b, xIndex], { frameUrl: '/frame.html', importers: imports }));
    render(<>{result.current.instruments[2]!.render(ctx)}</>);
    await waitFor(() => expect(result.current.isReady(xIndex.id)).toBe(true));
    expect(imports['/x.stories.tsx']).toHaveBeenCalledTimes(1);
    expect(result.current.instruments[2]?.title).toBe('X');
  });


  it('reload drops a file and imports it again for the entries that had it', async () => {
    const imports = importers();
    const { result } = renderHook(() => useStoryRegistry([a, b], { frameUrl: '/frame.html', importers: imports }));
    const { rerender } = render(<>{result.current.instruments[0]!.render(ctx)}</>);
    await waitFor(() => expect(result.current.isReady('x--a')).toBe(true));
    act(() => result.current.reload('/x.stories.tsx'));
    expect(result.current.isReady('x--a')).toBe(false);
    rerender(<>{result.current.instruments[0]!.render(ctx)}</>);
    await waitFor(() => expect(result.current.isReady('x--a')).toBe(true));
    expect(imports['/x.stories.tsx']).toHaveBeenCalledTimes(2);
  });
});

describe('Workshop in the document', () => {
  it('renders the story the hash names inside a story host, with no frame', async () => {
    location.hash = '#/x--a';
    const { container } = render(
      <Workshop index={[a, b]} frameUrl="/frame.html" importers={importers()} setup={{}} storage={createMemoryAdapter()} />,
    );
    // A lab, a trial and a story module under a loaded test run take more than testing-library's second.
    await waitFor(() => expect(screen.getByRole('button', { name: 'hi' })).toBeInTheDocument(), { timeout: 15_000 });
    const host = screen.getByRole('button', { name: 'hi' }).closest('.fg-story');
    expect(host).not.toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    history.replaceState(null, '', '/');
  });

  it('keeps an isolated story in a frame and never imports its module', async () => {
    location.hash = '#/y--c';
    const imports = importers();
    const { container } = render(
      <Workshop index={[a, c]} frameUrl="/frame.html" importers={imports} setup={{}} storage={createMemoryAdapter()} />,
    );
    await waitFor(() => expect(container.querySelector('iframe.fg-frame-view')).not.toBeNull(), { timeout: 5000 });
    expect(container.querySelector('iframe.fg-frame-view')?.getAttribute('src')).toBe('/frame.html#y--c');
    expect(imports['/y.stories.tsx']).not.toHaveBeenCalled();
    history.replaceState(null, '', '/');
  });
});

describe('the lab’s mode switch reaching trials', () => {
  const following: ShellConfig = {
    globals: {
      mode: {
        label: 'Mode',
        default: FOLLOW_APP,
        follows: (chrome) => chrome.mode,
        options: [
          { value: 'auto', label: 'Auto (OS)' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ],
      },
    },
  };
  const modes = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls.map(([globals]) => (globals as { mode?: unknown }).mode);

  // One case per kind of trial: an index page must take the globals exactly as a story does.
  it.each([
    ['a story', 'x--a'],
    ['an index page', indexId('X')],
  ])('%s follows the switch while Mode is App, and a Mode picked in the toolbar overrides it', async (_kind, id) => {
    location.hash = `#/${id}`;
    const applyGlobals = vi.fn();
    render(
      <Workshop
        index={[a, b]}
        frameUrl="/frame.html"
        importers={importers()}
        setup={{ applyGlobals }}
        config={following}
        storage={createMemoryAdapter()}
      />,
    );
    await waitFor(() => expect(applyGlobals).toHaveBeenCalled(), { timeout: 15_000 });
    await waitFor(() => expect(modes(applyGlobals).at(-1)).toBe('auto'));

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Theme: Auto/ }));
    });
    await waitFor(() => expect(modes(applyGlobals).at(-1)).toBe('light'));

    const toolbar = within(screen.getByRole('toolbar', { name: 'Globals' }));
    expect(toolbar.getByRole('button', { name: /Mode/ })).toHaveTextContent('App');
    act(() => {
      fireEvent.click(toolbar.getByRole('button', { name: /Mode/ }));
    });
    fireEvent.click(await screen.findByRole('option', { name: 'Dark' }));
    await waitFor(() => expect(modes(applyGlobals).at(-1)).toBe('dark'));
    // The switch still styles the lab's own chrome; it just no longer reaches the trial.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Theme: Light/ }));
    });
    await waitFor(() => expect(screen.getByRole('button', { name: /^Theme: Dark/ })).toBeInTheDocument());
    expect(modes(applyGlobals).at(-1)).toBe('dark');
    history.replaceState(null, '', '/');
  });
});
