import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PathfinderPanel } from './PathfinderPanel';
import type { BooleansAdapter, UseBooleansReturn } from '@orochi235/weasel';
import { asNodeId } from '@orochi235/weasel';

const noop = () => {};
const noopActions: UseBooleansReturn = {
  union: noop,
  intersect: noop,
  subtract: noop,
  exclude: noop,
  divide: noop,
};

function adapterWith(paths: number): Pick<BooleansAdapter, 'getSelection' | 'getWorldPath'> {
  const ids = Array.from({ length: paths }, (_, i) => asNodeId(`id-${i}`));
  return {
    getSelection: () => ids,
    getWorldPath: (id) => (
      ids.includes(id)
        ? { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' }
        : undefined
    ),
  };
}

describe('PathfinderPanel', () => {
  it('renders five buttons in op order', () => {
    render(<PathfinderPanel adapter={adapterWith(2)} actions={noopActions} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual([
      'pathfinder-op-union',
      'pathfinder-op-intersect',
      'pathfinder-op-subtract',
      'pathfinder-op-exclude',
      'pathfinder-op-divide',
    ]);
  });

  it('default aria-labels are the capitalized op names', () => {
    render(<PathfinderPanel adapter={adapterWith(2)} actions={noopActions} />);
    expect(screen.getByLabelText('Union')).toBeTruthy();
    expect(screen.getByLabelText('Intersect')).toBeTruthy();
    expect(screen.getByLabelText('Subtract')).toBeTruthy();
    expect(screen.getByLabelText('Exclude')).toBeTruthy();
    expect(screen.getByLabelText('Divide')).toBeTruthy();
  });
});

describe('PathfinderPanel — disabled state', () => {
  it('all buttons disabled when fewer than 2 valid paths selected', () => {
    render(<PathfinderPanel adapter={adapterWith(1)} actions={noopActions} />);
    for (const op of ['union', 'intersect', 'subtract', 'exclude', 'divide']) {
      const btn = screen.getByTestId(`pathfinder-op-${op}`) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute('aria-disabled')).toBe('true');
    }
  });

  it('all buttons disabled on empty selection', () => {
    render(<PathfinderPanel adapter={adapterWith(0)} actions={noopActions} />);
    for (const op of ['union', 'intersect', 'subtract', 'exclude', 'divide']) {
      const btn = screen.getByTestId(`pathfinder-op-${op}`) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    }
  });

  it('all buttons enabled at exactly 2 valid paths', () => {
    render(<PathfinderPanel adapter={adapterWith(2)} actions={noopActions} />);
    for (const op of ['union', 'intersect', 'subtract', 'exclude', 'divide']) {
      const btn = screen.getByTestId(`pathfinder-op-${op}`) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    }
  });
});

describe('PathfinderPanel — click dispatch', () => {
  it('clicking an enabled button invokes the matching action exactly once', () => {
    const actions: UseBooleansReturn = {
      union: vi.fn(),
      intersect: vi.fn(),
      subtract: vi.fn(),
      exclude: vi.fn(),
      divide: vi.fn(),
    };
    render(<PathfinderPanel adapter={adapterWith(2)} actions={actions} />);
    for (const op of ['union', 'intersect', 'subtract', 'exclude', 'divide'] as const) {
      fireEvent.click(screen.getByTestId(`pathfinder-op-${op}`));
      expect(actions[op]).toHaveBeenCalledTimes(1);
    }
  });

  it('clicking a disabled button does not invoke the action', () => {
    const actions: UseBooleansReturn = {
      union: vi.fn(),
      intersect: vi.fn(),
      subtract: vi.fn(),
      exclude: vi.fn(),
      divide: vi.fn(),
    };
    render(<PathfinderPanel adapter={adapterWith(1)} actions={actions} />);
    fireEvent.click(screen.getByTestId('pathfinder-op-union'));
    expect(actions.union).not.toHaveBeenCalled();
  });
});
