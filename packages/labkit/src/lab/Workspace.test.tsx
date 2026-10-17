import { act, fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, test, vi } from 'vitest';
import { TileGrip } from './TileGrip';
import { Workspace } from './Workspace';

/** A tile whose whole body is its grip, as a plain tile draws one. */
function DragProbe({ label }: { label: string }) {
  return <TileGrip data-testid={`drag-${label}`}>{label}</TileGrip>;
}

const VIEWPORT = { w: 800, h: 600 };

describe('Workspace', () => {
  test('renders all children', async () => {
    await renderSettled(
      <Workspace viewport={VIEWPORT}>
        <div>one</div>
        <div>two</div>
        <div>three</div>
      </Workspace>,
      { wrapper: withIcons },
    );
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(screen.getByText('three')).toBeInTheDocument();
  });

  test('keeps a child with the tile its id names when an earlier one closes', async () => {
    const ids = ['a', 'b', 'c'];
    const { rerender, container } = await renderSettled(
      <Workspace ids={ids} viewport={VIEWPORT}>
        <div>a</div>
        <div>b</div>
        <div>c</div>
      </Workspace>,
      { wrapper: withIcons },
    );
    expect(container.querySelector('[data-node="c"]')).toHaveTextContent('c');

    await act(async () => {
      rerender(
        <Workspace ids={['b', 'c']} viewport={VIEWPORT}>
          <div>b</div>
          <div>c</div>
        </Workspace>,
      );
    });
    expect(container.querySelector('[data-node="c"]')).toHaveTextContent('c');
    expect(container.querySelector('[data-node="a"]')).toBeNull();
  });

  test('opens a tile on double-click only where expandOnDoubleClick says so', async () => {
    const { container } = await renderSettled(
      <Workspace ids={['a', 'b']} viewport={VIEWPORT} expandOnDoubleClick={(id) => id === 'a'}>
        <div>a</div>
        <div>b</div>
      </Workspace>,
      { wrapper: withIcons },
    );
    const box = (id: string) => container.querySelector(`[data-node="${id}"] .lk-lightbox`);
    expect(screen.getAllByRole('button', { name: 'Expand' })).toHaveLength(2);
    fireEvent.doubleClick(screen.getByText('b'));
    expect(box('b')).not.toHaveClass('lk-lightbox--expanded');
    fireEvent.doubleClick(screen.getByText('a'));
    expect(box('a')).toHaveClass('lk-lightbox--expanded');
  });

  test('lets a predicate take the lightbox off one tile', async () => {
    await renderSettled(
      <Workspace ids={['a', 'b']} viewport={VIEWPORT} lightbox={(id) => id !== 'b'}>
        <div>a</div>
        <div>b</div>
      </Workspace>,
      { wrapper: withIcons },
    );
    expect(screen.getAllByRole('button', { name: 'Expand' })).toHaveLength(1);
  });

  test('lightbox={false} leaves no tile expandable', async () => {
    await renderSettled(
      <Workspace viewport={VIEWPORT} lightbox={false} expandOnDoubleClick>
        <div>a</div>
      </Workspace>,
      { wrapper: withIcons },
    );
    fireEvent.doubleClick(screen.getByText('a'));
    expect(document.querySelector('.lk-lightbox--expanded')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Expand' })).toBeNull();
  });

  test('uses lk-workspace class', async () => {
    const { container } = await renderSettled(
      <Workspace viewport={VIEWPORT}>
        <div />
      </Workspace>,
      { wrapper: withIcons },
    );
    expect((container.firstChild as HTMLElement).className).toContain('lk-workspace');
  });

  test('renders resize affordances only when resizable', async () => {
    const { container, rerender } = await renderSettled(
      <Workspace ids={['a', 'b']} viewport={VIEWPORT}>
        <div>a</div>
        <div>b</div>
      </Workspace>,
      { wrapper: withIcons },
    );
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(0);

    await act(async () => {
      rerender(
        <Workspace ids={['a', 'b']} resizable viewport={VIEWPORT}>
          <div>a</div>
          <div>b</div>
        </Workspace>,
      );
    });
    expect(container.querySelectorAll('[role="separator"]').length).toBeGreaterThan(0);
  });

  test('applies a saved extent to a tile as it registers', async () => {
    const { container } = await renderSettled(
      <Workspace
        ids={['a', 'b']}
        resizable
        viewport={VIEWPORT}
        layout={{ a: { span: { cols: 2 } } }}
      >
        <div>a</div>
        <div>b</div>
      </Workspace>,
      { wrapper: withIcons },
    );
    const a = container.querySelector('[data-node="a"]') as HTMLElement;
    const b = container.querySelector('[data-node="b"]') as HTMLElement;
    // `a` holds two columns, so it is wider than the single-column `b`.
    expect(Number.parseFloat(a.style.width)).toBeGreaterThan(Number.parseFloat(b.style.width));
  });

  test('reports the order a drop would produce instead of applying it', async () => {
    // jsdom lays nothing out, so a drop is hit-tested against each element's inline rect.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const { left, top, width, height } = (this as HTMLElement).style;
      const px = (value: string) => Number.parseFloat(value) || 0;
      return new DOMRect(px(left), px(top), px(width), px(height));
    });
    const onReorder = vi.fn();
    const { container } = await renderSettled(
      <Workspace ids={['a', 'b']} reorderable onReorder={onReorder} viewport={VIEWPORT}>
        <DragProbe label="a" />
        <DragProbe label="b" />
      </Workspace>,
      { wrapper: withIcons },
    );
    const grip = screen.getByTestId('drag-a');
    // Drag `a` from its own tile to the far side of `b`.
    await act(async () => {
      fireEvent.pointerDown(grip, { pointerId: 1, clientX: 100, clientY: 300 });
      fireEvent.pointerMove(grip, { pointerId: 1, clientX: 760, clientY: 300 });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      fireEvent.pointerUp(grip, { pointerId: 1, clientX: 760, clientY: 300 });
    });

    expect(onReorder).toHaveBeenCalledWith(['b', 'a']);
    const nodes = [...container.querySelectorAll('[data-node]')].map((el) =>
      el.getAttribute('data-node'),
    );
    expect(nodes).toEqual(['a', 'b']);
    vi.restoreAllMocks();
  });

  test('offers no drag source unless reorderable', async () => {
    await renderSettled(
      <Workspace ids={['a', 'b']} viewport={VIEWPORT}>
        <DragProbe label="a" />
        <DragProbe label="b" />
      </Workspace>,
      { wrapper: withIcons },
    );
    expect(screen.getByTestId('drag-a')).not.toHaveAttribute('data-lk-tile-grip');
    expect(screen.getByTestId('drag-b')).not.toHaveAttribute('data-lk-tile-grip');
  });

  test('a grip outside a workspace is a plain div', async () => {
    await renderSettled(<TileGrip className="lk-probe">bar</TileGrip>, { wrapper: withIcons });
    const grip = screen.getByText('bar');
    expect(grip).toHaveClass('lk-probe');
    expect(grip).not.toHaveAttribute('data-lk-tile-grip');
  });
});
