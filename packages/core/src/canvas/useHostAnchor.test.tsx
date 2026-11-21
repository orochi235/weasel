import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { useHostAnchor } from './useHostAnchor';

afterEach(() => { cleanup(); });

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function Panel({ resolveHost }: { resolveHost: () => Element | null }) {
  useHostAnchor(resolveHost, { align: { x: 'start', y: 'start' }, offset: { x: 0, y: 0 } });
  return null;
}

describe('useHostAnchor after an abandoned render', () => {
  it('recomputes against the committed host resolver', async () => {
    const host = document.createElement('div');
    const a = vi.fn(() => host);
    const b = vi.fn(() => host);
    renderThenAbandon(a, b, (resolveHost) => <Panel resolveHost={resolveHost} />);
    a.mockClear();
    b.mockClear();

    act(() => { window.dispatchEvent(new Event('resize')); });
    await act(frame);

    expect(a).toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });
});

describe('useHostAnchor with a host that mounts late', () => {
  it('places the panel once the host appears, with no scroll or resize', async () => {
    let host: Element | null = null;
    let style: unknown = 'unset';
    function Probe() {
      style = useHostAnchor(() => host, { align: { x: 'start', y: 'start' }, offset: { x: 0, y: 0 } }).style;
      return null;
    }
    render(<Probe />);
    expect(style).toBeNull();

    const el = document.createElement('div');
    document.body.appendChild(el);
    host = el;
    try {
      await act(async () => { await Promise.resolve(); await frame(); });
      expect(style).not.toBeNull();
    } finally {
      el.remove();
    }
  });
});

describe('useHostAnchor against a page with scrollbars', () => {
  it('pins an end-aligned panel against the viewport inside the scrollbars', async () => {
    const root = document.documentElement;
    const restore = [
      vi.spyOn(root, 'clientWidth', 'get').mockReturnValue(985),
      vi.spyOn(root, 'clientHeight', 'get').mockReturnValue(753),
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000),
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(768),
    ];
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 985, height: 753, right: 985, bottom: 753 }) as DOMRect;
    document.body.appendChild(el);
    let style: unknown = null;
    function Probe() {
      style = useHostAnchor(() => el, { align: { x: 'end', y: 'end' }, offset: { x: 0, y: 0 } }).style;
      return null;
    }
    try {
      render(<Probe />);
      await act(async () => { await Promise.resolve(); await frame(); });
      expect(style).toMatchObject({ right: 0, bottom: 0 });
    } finally {
      el.remove();
      for (const r of restore) r.mockRestore();
    }
  });
});
