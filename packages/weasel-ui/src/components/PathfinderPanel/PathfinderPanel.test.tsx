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

describe('PathfinderPanel — overrides', () => {
  it('icons prop overrides the default icon for that op only', () => {
    const Custom = () => <span data-testid="custom-union-icon">★</span>;
    render(
      <PathfinderPanel
        adapter={adapterWith(2)}
        actions={noopActions}
        icons={{ union: <Custom /> }}
      />,
    );
    expect(screen.getByTestId('custom-union-icon')).toBeTruthy();
    // intersect still renders its default svg
    expect(screen.getByTestId('pathfinder-op-intersect').querySelector('svg')).toBeTruthy();
  });

  it('labels prop overrides aria-label and title for that op only', () => {
    render(
      <PathfinderPanel
        adapter={adapterWith(2)}
        actions={noopActions}
        labels={{ union: 'Combine', subtract: 'Minus Front' }}
      />,
    );
    const u = screen.getByTestId('pathfinder-op-union');
    expect(u.getAttribute('aria-label')).toBe('Combine');
    expect(u.getAttribute('title')).toBe('Combine');
    const sub = screen.getByTestId('pathfinder-op-subtract');
    expect(sub.getAttribute('aria-label')).toBe('Minus Front');
    expect(screen.getByTestId('pathfinder-op-intersect').getAttribute('aria-label'))
      .toBe('Intersect');
  });

  it('orientation="vertical" applies the vertical class', () => {
    const { container } = render(
      <PathfinderPanel
        adapter={adapterWith(2)}
        actions={noopActions}
        orientation="vertical"
      />,
    );
    const root = container.querySelector('[role="toolbar"]') as HTMLElement;
    expect(Array.from(root.classList).some((c) => c.includes('vertical'))).toBe(true);
  });

  it('orientation defaults to horizontal (no vertical class)', () => {
    const { container } = render(
      <PathfinderPanel adapter={adapterWith(2)} actions={noopActions} />,
    );
    const root = container.querySelector('[role="toolbar"]') as HTMLElement;
    expect(Array.from(root.classList).some((c) => c.includes('vertical'))).toBe(false);
  });
});

describe('PathfinderPanel — mixed selection', () => {
  it('non-path selection members are filtered out of the disabled predicate', () => {
    const ids = [asNodeId('p0'), asNodeId('p1'), asNodeId('text-1')];
    const adapter: Pick<BooleansAdapter, 'getSelection' | 'getWorldPath'> = {
      getSelection: () => ids,
      getWorldPath: (id) => (
        id === 'text-1'
          ? undefined  // not a path
          : { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' }
      ),
    };
    render(<PathfinderPanel adapter={adapter} actions={noopActions} />);
    expect((screen.getByTestId('pathfinder-op-union') as HTMLButtonElement).disabled).toBe(false);
  });

  it('one valid path among non-paths → disabled', () => {
    const ids = [asNodeId('p0'), asNodeId('text-1'), asNodeId('image-1')];
    const adapter: Pick<BooleansAdapter, 'getSelection' | 'getWorldPath'> = {
      getSelection: () => ids,
      getWorldPath: (id) => (
        id === 'p0'
          ? { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' }
          : undefined
      ),
    };
    render(<PathfinderPanel adapter={adapter} actions={noopActions} />);
    expect((screen.getByTestId('pathfinder-op-union') as HTMLButtonElement).disabled).toBe(true);
  });
});
