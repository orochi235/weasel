import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { WorkspaceGrid } from './WorkspaceGrid';

describe('WorkspaceGrid', () => {
  test('renders all children', () => {
    render(
      <WorkspaceGrid>
        <div>one</div>
        <div>two</div>
        <div>three</div>
      </WorkspaceGrid>,
    );
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(screen.getByText('three')).toBeInTheDocument();
  });

  test('sets CSS custom properties for grid dimensions based on child count', () => {
    const { container } = render(
      <WorkspaceGrid>
        <div>a</div>
        <div>b</div>
        <div>c</div>
      </WorkspaceGrid>,
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid.style.getPropertyValue('--lk-grid-cols')).toBe('2');
    expect(grid.style.getPropertyValue('--lk-grid-rows')).toBe('2');
  });

  test('uses lk-workspace-grid class', () => {
    const { container } = render(
      <WorkspaceGrid>
        <div />
      </WorkspaceGrid>,
    );
    expect((container.firstChild as HTMLElement).className).toBe('lk-workspace-grid');
  });
});
