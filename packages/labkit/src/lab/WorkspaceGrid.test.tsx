import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { WorkspaceGrid } from './WorkspaceGrid';

const VIEWPORT = { w: 800, h: 600 };

describe('WorkspaceGrid', () => {
  test('renders all children', () => {
    render(
      <WorkspaceGrid viewport={VIEWPORT}>
        <div>one</div>
        <div>two</div>
        <div>three</div>
      </WorkspaceGrid>,
    );
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(screen.getByText('three')).toBeInTheDocument();
  });

  test('keeps a child with the tile its id names when an earlier one closes', () => {
    const ids = ['a', 'b', 'c'];
    const { rerender, container } = render(
      <WorkspaceGrid ids={ids} viewport={VIEWPORT}>
        <div>a</div>
        <div>b</div>
        <div>c</div>
      </WorkspaceGrid>,
    );
    expect(container.querySelector('[data-node="c"]')).toHaveTextContent('c');

    rerender(
      <WorkspaceGrid ids={['b', 'c']} viewport={VIEWPORT}>
        <div>b</div>
        <div>c</div>
      </WorkspaceGrid>,
    );
    expect(container.querySelector('[data-node="c"]')).toHaveTextContent('c');
    expect(container.querySelector('[data-node="a"]')).toBeNull();
  });

  test('uses lk-workspace-grid class', () => {
    const { container } = render(
      <WorkspaceGrid viewport={VIEWPORT}>
        <div />
      </WorkspaceGrid>,
    );
    expect((container.firstChild as HTMLElement).className).toContain('lk-workspace-grid');
  });

  test('renders resize affordances only when resizable', () => {
    const { container, rerender } = render(
      <WorkspaceGrid ids={['a', 'b']} viewport={VIEWPORT}>
        <div>a</div>
        <div>b</div>
      </WorkspaceGrid>,
    );
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(0);

    rerender(
      <WorkspaceGrid ids={['a', 'b']} resizable viewport={VIEWPORT}>
        <div>a</div>
        <div>b</div>
      </WorkspaceGrid>,
    );
    expect(container.querySelectorAll('[role="separator"]').length).toBeGreaterThan(0);
  });
});
