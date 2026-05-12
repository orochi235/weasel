import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
