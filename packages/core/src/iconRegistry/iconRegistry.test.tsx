import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { IconTable } from '@weasel-js/icons';
import { IconRegistryProvider, useIconGlyph, useIconVariant } from './index';

const core: IconTable = {
  namespace: 'core', owner: '@weasel-js/core',
  icons: { undo: { body: '<path d="u"/>', group: 'History', tags: ['history'] } },
};
const more: IconTable = {
  namespace: 'core', owner: '@weasel-js/core',
  icons: { redo: { body: '<path d="r"/>', group: 'History', tags: [] } },
};

describe('icon registry provider', () => {
  it('serves a glyph from the tables it was given', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <IconRegistryProvider icons={core}>{children}</IconRegistryProvider>;
    const { result } = renderHook(() => useIconGlyph('core:undo'), { wrapper });
    expect(result.current?.body).toBe('<path d="u"/>');
  });

  it('replaces the tables it was given when its icons change, from the first render on', () => {
    function Probe() {
      return <span>{`${useIconGlyph('core:undo')?.body ?? 'none'} ${useIconGlyph('core:redo')?.body ?? 'none'}`}</span>;
    }
    const tree = (icons: IconTable) => (
      <StrictMode><IconRegistryProvider icons={icons}><Probe /></IconRegistryProvider></StrictMode>
    );
    const { rerender, container } = render(tree(core));
    expect(container.textContent).toBe('<path d="u"/> none');
    rerender(tree(more));
    expect(container.textContent).toBe('none <path d="r"/>');
    rerender(tree(core));
    expect(container.textContent).toBe('<path d="u"/> none');
  });

  it('mounts with no icons and registers ones that arrive later', () => {
    function Probe() {
      return <span>{useIconGlyph('core:undo')?.body ?? 'none'}</span>;
    }
    const tree = (icons?: IconTable) => <IconRegistryProvider icons={icons}><Probe /></IconRegistryProvider>;
    const { rerender, container } = render(tree());
    expect(container.textContent).toBe('none');
    rerender(tree(core));
    expect(container.textContent).toBe('<path d="u"/>');
  });

  it('answers undefined with no provider in scope, and for a miss', () => {
    expect(renderHook(() => useIconGlyph('core:undo')).result.current).toBeUndefined();
    const wrapper = ({ children }: { children: ReactNode }) => <IconRegistryProvider icons={core}>{children}</IconRegistryProvider>;
    expect(renderHook(() => useIconGlyph('core:redo'), { wrapper }).result.current).toBeUndefined();
  });

  it('loads a variant when asked, and re-renders with its entries', async () => {
    const loader = vi.fn(async () => ({ default: [more] }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <IconRegistryProvider icons={core} variants={{ all: loader }}>{children}</IconRegistryProvider>
    );
    const { result } = renderHook(() => useIconVariant('all'), { wrapper });
    await waitFor(() => expect(result.current.state).toBe('loaded'));
    expect(result.current.entries.map((e) => e.ref).sort()).toEqual(['core:redo', 'core:undo']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reports a variant with no loader as unknown, listing what is registered', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <IconRegistryProvider icons={core}>{children}</IconRegistryProvider>;
    const { result } = renderHook(() => useIconVariant('picker'), { wrapper });
    expect(result.current.state).toBe('unknown');
    expect(result.current.entries.map((e) => e.ref)).toEqual(['core:undo']);
  });

  it('loads a variant whose loader arrives after the component mounted', async () => {
    const loader = vi.fn(async () => ({ default: [more] }));
    function Probe() {
      const { state } = useIconVariant('all');
      return <span>{state}</span>;
    }
    const tree = (variants?: { all: typeof loader }) => (
      <IconRegistryProvider icons={core} variants={variants}><Probe /></IconRegistryProvider>
    );
    const { rerender } = render(tree());
    expect(screen.getByText('unknown')).toBeTruthy();
    await act(async () => rerender(tree({ all: loader })));
    await waitFor(() => expect(screen.getByText('loaded')).toBeTruthy());
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('a failed variant can be asked for again', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    const loader = async () => { if (fail) throw new Error('offline'); return { default: [more] }; };
    function Probe() {
      const { state } = useIconVariant('all');
      return <span>{state}</span>;
    }
    const tree = (k: number) => (
      <IconRegistryProvider icons={core} variants={{ all: loader }}><Probe key={k} /></IconRegistryProvider>
    );
    const { rerender } = render(tree(1));
    await waitFor(() => expect(screen.getByText('failed')).toBeTruthy());
    fail = false;
    await act(async () => rerender(tree(2)));
    await waitFor(() => expect(screen.getByText('loaded')).toBeTruthy());
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
