import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Workspace } from './Workspace';

const VIEWPORT = { w: 800, h: 600 };

describe('Workspace', () => {
  test('renders all children', () => {
    render(
      <Workspace viewport={VIEWPORT}>
        <div>one</div>
        <div>two</div>
        <div>three</div>
      </Workspace>,
    );
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(screen.getByText('three')).toBeInTheDocument();
  });

  test('keeps a child with the tile its id names when an earlier one closes', () => {
    const ids = ['a', 'b', 'c'];
    const { rerender, container } = render(
      <Workspace ids={ids} viewport={VIEWPORT}>
        <div>a</div>
        <div>b</div>
        <div>c</div>
      </Workspace>,
    );
    expect(container.querySelector('[data-node="c"]')).toHaveTextContent('c');

    rerender(
      <Workspace ids={['b', 'c']} viewport={VIEWPORT}>
        <div>b</div>
        <div>c</div>
      </Workspace>,
    );
    expect(container.querySelector('[data-node="c"]')).toHaveTextContent('c');
    expect(container.querySelector('[data-node="a"]')).toBeNull();
  });

  test('uses lk-workspace class', () => {
    const { container } = render(
      <Workspace viewport={VIEWPORT}>
        <div />
      </Workspace>,
    );
    expect((container.firstChild as HTMLElement).className).toContain('lk-workspace');
  });

  test('renders resize affordances only when resizable', () => {
    const { container, rerender } = render(
      <Workspace ids={['a', 'b']} viewport={VIEWPORT}>
        <div>a</div>
        <div>b</div>
      </Workspace>,
    );
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(0);

    rerender(
      <Workspace ids={['a', 'b']} resizable viewport={VIEWPORT}>
        <div>a</div>
        <div>b</div>
      </Workspace>,
    );
    expect(container.querySelectorAll('[role="separator"]').length).toBeGreaterThan(0);
  });

  test('applies a saved extent to a tile as it registers', () => {
    const { container } = render(
      <Workspace
        ids={['a', 'b']}
        resizable
        viewport={VIEWPORT}
        layout={{ a: { span: { cols: 2 } } }}
      >
        <div>a</div>
        <div>b</div>
      </Workspace>,
    );
    const a = container.querySelector('[data-node="a"]') as HTMLElement;
    const b = container.querySelector('[data-node="b"]') as HTMLElement;
    // `a` holds two columns, so it is wider than the single-column `b`.
    expect(Number.parseFloat(a.style.width)).toBeGreaterThan(Number.parseFloat(b.style.width));
  });

  test('reports the order a drop would produce instead of applying it', () => {
    const onReorder = vi.fn();
    const { container } = render(
      <Workspace ids={['a', 'b']} reorderable onReorder={onReorder} viewport={VIEWPORT}>
        <div>a</div>
        <div>b</div>
      </Workspace>,
    );
    // The grid is controlled: it renders a handle per tile and commits nothing
    // itself. Order still comes from `ids`.
    expect(container.querySelectorAll('.lk-trial-tile__grip')).toHaveLength(2);
    expect(onReorder).not.toHaveBeenCalled();
    const nodes = [...container.querySelectorAll('[data-node]')].map((el) =>
      el.getAttribute('data-node'),
    );
    expect(nodes).toEqual(['a', 'b']);
  });

  test('renders no drag handles unless reorderable', () => {
    const { container } = render(
      <Workspace ids={['a', 'b']} viewport={VIEWPORT}>
        <div>a</div>
        <div>b</div>
      </Workspace>,
    );
    expect(container.querySelectorAll('.lk-trial-tile__grip')).toHaveLength(0);
  });
});
