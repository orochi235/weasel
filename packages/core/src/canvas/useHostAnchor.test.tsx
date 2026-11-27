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

describe('useHostAnchor on its first paint', () => {
  // The panel's ref is left off: its state update alone would flush the passive effects early.
  it('positions the panel in the commit that mounts it, before passive effects run', async () => {
    const { createRoot } = await import('react-dom/client');
    const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const wasAct = env.IS_REACT_ACT_ENVIRONMENT;
    env.IS_REACT_ACT_ENVIRONMENT = false;
    const host = document.createElement('div');
    host.getBoundingClientRect = () => ({ x: 40, y: 30, left: 40, top: 30, width: 10, height: 10, right: 50, bottom: 40 }) as DOMRect;
    document.body.appendChild(host);
    const container = document.createElement('div');
    document.body.appendChild(container);
    function Probe() {
      const { style } = useHostAnchor(() => host, { align: { x: 'start', y: 'start' }, offset: { x: 0, y: 0 } });
      return <div data-top={style?.top ?? 'none'} />;
    }
    const root = createRoot(container);
    try {
      // A mutation observer's callback runs once the task that committed the panel ends, before a passive effect's.
      const firstPaint = new Promise<string | null>((resolve) => {
        const watch = new MutationObserver(() => {
          watch.disconnect();
          resolve(container.firstElementChild?.getAttribute('data-top') ?? null);
        });
        watch.observe(container, { childList: true });
      });
      root.render(<Probe />);
      expect(await firstPaint).toBe('30');
    } finally {
      root.unmount();
      container.remove();
      host.remove();
      env.IS_REACT_ACT_ENVIRONMENT = wasAct;
    }
  });
});

describe('useHostAnchor when the host changes', () => {
  const box = (top: number): Element => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ x: 0, y: top, left: 0, top, width: 10, height: 10, right: 10, bottom: top + 10 }) as DOMRect;
    return el;
  };
  const anchor = { align: { x: 'start', y: 'start' }, offset: { x: 0, y: 0 } } as const;

  it('moves to a new element its selector starts naming, with no scroll or resize', async () => {
    const first = box(10);
    first.className = 'host';
    document.body.appendChild(first);
    let style: { top?: number } | null = null;
    function Probe() {
      style = useHostAnchor(() => document.querySelector('.host'), anchor).style;
      return null;
    }
    const second = box(70);
    try {
      render(<Probe />);
      await act(async () => { await Promise.resolve(); await frame(); });
      expect(style).toMatchObject({ top: 10 });

      first.className = '';
      second.className = 'host';
      document.body.appendChild(second);
      await act(async () => { await Promise.resolve(); await frame(); });
      expect(style).toMatchObject({ top: 70 });
    } finally {
      first.remove();
      second.remove();
    }
  });

  it('moves to the host a new resolveHost names', async () => {
    const [a, b] = [box(10), box(70)];
    document.body.append(a, b);
    let style: { top?: number } | null = null;
    function Probe({ host }: { host: Element }) {
      style = useHostAnchor(() => host, anchor).style;
      return null;
    }
    try {
      const { rerender } = render(<Probe host={a} />);
      await act(async () => { await Promise.resolve(); await frame(); });
      expect(style).toMatchObject({ top: 10 });
      rerender(<Probe host={b} />);
      await act(async () => { await Promise.resolve(); await frame(); });
      expect(style).toMatchObject({ top: 70 });
    } finally {
      a.remove();
      b.remove();
    }
  });
});

describe('useHostAnchor while its host is unresolved', () => {
  it('asks for no frame when an unrelated attribute changes', async () => {
    function Probe() {
      useHostAnchor(() => document.querySelector('.absent-host'), { align: { x: 'start', y: 'start' }, offset: { x: 0, y: 0 } });
      return null;
    }
    render(<Probe />);
    await act(async () => { await Promise.resolve(); await frame(); });
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    try {
      document.body.setAttribute('data-unrelated', '1');
      await act(async () => { await Promise.resolve(); });
      expect(raf).not.toHaveBeenCalled();
    } finally {
      raf.mockRestore();
      document.body.removeAttribute('data-unrelated');
    }
  });
});
