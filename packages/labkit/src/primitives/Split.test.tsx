import { act, fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Split } from './Split';

const VIEWPORT = { w: 800, h: 600 };

function renderBody(props: Partial<Parameters<typeof Split>[0]> = {}) {
  return render(
    <Split viewport={VIEWPORT} sidebar={<p>sidebar body</p>} {...props}>
      <p>instrument output</p>
    </Split>,
  );
}

describe('Split', () => {
  it('renders both panes', () => {
    renderBody();
    expect(screen.getByText('sidebar body')).toBeInTheDocument();
    expect(screen.getByText('instrument output')).toBeInTheDocument();
  });

  it('puts a labeled separator between the sidebar and the content', () => {
    renderBody({ width: 320 });
    const seam = screen.getByRole('separator');
    expect(seam).toHaveAttribute('aria-orientation', 'horizontal');
    expect(seam).toHaveAttribute('aria-valuenow', '320');
    expect(seam).toHaveAccessibleName(/sidebar/i);
  });

  it('reports the width a drag lands on', () => {
    const onWidthChange = vi.fn();
    renderBody({ width: 320, onWidthChange });
    const seam = screen.getByRole('separator');
    fireEvent.pointerDown(seam, { clientX: 320, clientY: 100 });
    fireEvent.pointerMove(seam, { clientX: 380, clientY: 100 });
    fireEvent.pointerUp(seam, { clientX: 380, clientY: 100 });
    expect(onWidthChange).toHaveBeenLastCalledWith(380);
  });

  it('resizes from the keyboard', () => {
    const onWidthChange = vi.fn();
    renderBody({ width: 320, onWidthChange });
    const seam = screen.getByRole('separator');
    fireEvent.keyDown(seam, { key: 'ArrowRight' });
    expect(onWidthChange).toHaveBeenLastCalledWith(328);
  });

  it('refuses to drag the sidebar past its stated bounds', () => {
    const onWidthChange = vi.fn();
    renderBody({ width: 320, minWidth: 200, maxWidth: 400, onWidthChange });
    const seam = screen.getByRole('separator');
    expect(seam).toHaveAttribute('aria-valuemin', '200');
    expect(seam).toHaveAttribute('aria-valuemax', '400');
    fireEvent.pointerDown(seam, { clientX: 320, clientY: 100 });
    fireEvent.pointerMove(seam, { clientX: 900, clientY: 100 });
    expect(onWidthChange).toHaveBeenLastCalledWith(400);
  });

  it('leaves the content pane a floor the seam cannot cross', () => {
    const onWidthChange = vi.fn();
    renderBody({ width: 320, maxWidth: 10_000, contentMinWidth: 300, onWidthChange });
    const seam = screen.getByRole('separator');
    fireEvent.pointerDown(seam, { clientX: 320, clientY: 100 });
    fireEvent.pointerMove(seam, { clientX: 5_000, clientY: 100 });
    expect(onWidthChange).toHaveBeenLastCalledWith(VIEWPORT.w - 300);
  });

  describe('in a zone too narrow for both floors', () => {
    const widths = (container: HTMLElement) =>
      ['lk-split-sidebar', 'lk-split-content'].map(
        (id) => (container.querySelector(`[data-node="${id}"]`) as HTMLElement).style.width,
      );
    const at = (w: number, sidebar: ReactNode | null = <p>side</p>) => (
      <Split viewport={{ w, h: 600 }} width={320} sidebar={sidebar}>
        <p>main</p>
      </Split>
    );

    it('shrinks the sidebar below its floor first, so the content keeps its own', () => {
      const { container } = render(at(176));
      expect(widths(container)).toEqual(['16px', '160px']);
    });

    it('shrinks the content once the sidebar has nothing left to give', () => {
      const { container } = render(at(100));
      expect(widths(container)).toEqual(['0px', '100px']);
    });

    it('holds a lone content pane to the zone', () => {
      const { container } = render(at(100, null));
      const pane = container.querySelector('[data-node="lk-split-content"]') as HTMLElement;
      expect(pane.style.width).toBe('100px');
    });

    it('gives the sidebar its width back when the zone widens, with nothing reported as a resize', async () => {
      const onWidthChange = vi.fn();
      const sized = (w: number) => (
        <Split
          viewport={{ w, h: 600 }}
          width={320}
          sidebar={<p>side</p>}
          onWidthChange={onWidthChange}
        >
          <p>main</p>
        </Split>
      );
      const { container, rerender } = render(sized(800));
      await act(async () => rerender(sized(176)));
      expect(widths(container)).toEqual(['16px', '160px']);
      await act(async () => rerender(sized(800)));
      expect(widths(container)).toEqual(['320px', '480px']);
      expect(onWidthChange).not.toHaveBeenCalled();
    });

    it('measures the zone when no viewport is given', async () => {
      const observed: { el: Element; report: (width: number) => void }[] = [];
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(private callback: ResizeObserverCallback) {}
          observe(el: Element) {
            observed.push({
              el,
              report: (width) =>
                this.callback(
                  [{ contentRect: { width, height: 600 } } as ResizeObserverEntry],
                  this as unknown as ResizeObserver,
                ),
            });
          }
          disconnect() {}
        },
      );
      try {
        const { container } = render(
          <Split width={320} sidebar={<p>side</p>}>
            <p>main</p>
          </Split>,
        );
        const zone = container.querySelector('.lk-split') as HTMLElement;
        const report = () =>
          act(async () => {
            for (const o of observed.filter((seen) => seen.el === zone)) o.report(176);
          });
        // The strip renders no pane until it has an extent, and Split measures from a pane.
        await report();
        expect(widths(container)).toEqual(['140px', '160px']);
        // Split starts observing the zone a task after the pane mounts.
        await act(() => new Promise((done) => setTimeout(done, 0)));
        await report();
        expect(widths(container)).toEqual(['16px', '160px']);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  it('puts the caller’s class names on its boxes', () => {
    const { container } = render(
      <Split
        viewport={VIEWPORT}
        className="lk-x__panes"
        sidebarClassName="lk-x__side"
        contentClassName="lk-x__main"
        label="Stories"
        sidebar={<p>side</p>}
      >
        <p>main</p>
      </Split>,
    );
    expect(container.querySelector('.lk-x__panes.lk-split')).not.toBeNull();
    expect(container.querySelector('.lk-x__side')?.textContent).toBe('side');
    expect(container.querySelector('.lk-x__main')?.textContent).toBe('main');
  });

  it('puts the sidebar after the content on the end side, where dragging the seam left widens it', () => {
    const onWidthChange = vi.fn();
    const { container } = render(
      <Split
        viewport={VIEWPORT}
        side="end"
        width={320}
        sidebarClassName="lk-x__side"
        contentClassName="lk-x__main"
        sidebar={<p>side</p>}
        onWidthChange={onWidthChange}
      >
        <p>main</p>
      </Split>,
    );
    const side = container.querySelector('.lk-x__side') as HTMLElement;
    const main = container.querySelector('.lk-x__main') as HTMLElement;
    expect(main.compareDocumentPosition(side) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const seam = screen.getByRole('separator');
    fireEvent.pointerDown(seam, { clientX: 480, clientY: 100 });
    fireEvent.pointerMove(seam, { clientX: 420, clientY: 100 });
    fireEvent.pointerUp(seam, { clientX: 420, clientY: 100 });
    expect(onWidthChange).toHaveBeenLastCalledWith(380);
  });

  it('names its seam after the sidebar label', () => {
    render(
      <Split viewport={VIEWPORT} label="Stories" sidebar={<p>side</p>}>
        <p>main</p>
      </Split>,
    );
    expect(screen.getByRole('separator')).toHaveAccessibleName(/stories/i);
  });

  it('renames its seam when the label changes', () => {
    const { rerender } = render(
      <Split viewport={VIEWPORT} label="Stories" sidebar={<p>side</p>}>
        <p>main</p>
      </Split>,
    );
    rerender(
      <Split viewport={VIEWPORT} label="Outline" sidebar={<p>side</p>}>
        <p>main</p>
      </Split>,
    );
    expect(screen.getByRole('separator')).toHaveAccessibleName(/outline/i);
  });

  it('renders the content alone, with no sidebar pane or seam, when the sidebar is null', () => {
    const { container } = renderBody({ sidebar: null, sidebarClassName: 'lk-x__side' });
    expect(screen.getByText('instrument output')).toBeInTheDocument();
    expect(container.querySelector('.lk-x__side')).toBeNull();
    expect(screen.queryByRole('separator')).toBeNull();
    const pane = container.querySelector('[data-node="lk-split-content"]') as HTMLElement;
    expect(pane.style.width).toBe(`${VIEWPORT.w}px`);
  });

  it('keeps the content mounted when a sidebar arrives and when it leaves', async () => {
    const mounts = vi.fn();
    function Output() {
      useEffect(() => mounts(), []);
      return <p>instrument output</p>;
    }
    const body = (sidebar: ReactNode) => (
      <Split viewport={VIEWPORT} sidebar={sidebar}>
        <Output />
      </Split>
    );
    const { rerender } = render(body(null));
    await act(async () => rerender(body(<p>sidebar body</p>)));
    expect(screen.getByText('sidebar body')).toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();
    await act(async () => rerender(body(null)));
    expect(screen.queryByText('sidebar body')).toBeNull();
    expect(screen.queryByRole('separator')).toBeNull();
    expect(mounts).toHaveBeenCalledTimes(1);
  });
});
