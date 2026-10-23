import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ActionsProvider, useAction, type Action } from '@weasel-js/core';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { Bar } from './Bar';
import { movedOrder } from './barOrder';

afterEach(cleanup);

const act = (name: string): PrefLeaf => ({ kind: 'action', name, description: '', default: undefined, action: `x.${name}` }) as PrefLeaf;

const schema: PrefGroup = {
  name: 'Tools',
  children: {
    a: act('A'),
    b: act('B'),
    g: { name: 'G', as: 'section', children: { p: act('P'), q: act('Q') } },
    arrange: { kind: 'actions', name: 'Arrange', description: '', default: undefined, group: 'arrange' } as PrefLeaf,
  },
};

const names = (): (string | null)[] => screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));

function Register({ action }: { action: Action }) {
  useAction(action);
  return null;
}
const reg = (id: string): Action => ({ id, label: id, group: 'arrange', invoker: { timing: 'immediate', run: () => {} } });

const withActions = (node: ReactNode) => (
  <ActionsProvider>
    <Register action={reg('front')} />
    <Register action={reg('back')} />
    {node}
  </ActionsProvider>
);

describe('Bar order', () => {
  it('draws cells in the stored order', () => {
    render(<Bar schema={schema} order={{ '': ['b', 'a', 'g', 'arrange'], g: ['q', 'p'] }} />);
    expect(names().slice(0, 4)).toEqual(['B', 'A', 'Q', 'P']);
  });

  it('marks each cell with its key and its container when onReorder is given', () => {
    const { container } = render(withActions(<Bar schema={schema} onReorder={() => {}} />));
    const marks = [...container.querySelectorAll('[data-bar-unit]')].map((el) => [el.getAttribute('data-bar-in'), el.getAttribute('data-bar-unit')]);
    expect(marks).toEqual([['', 'a'], ['', 'b'], ['g', 'p'], ['g', 'q'], ['', 'arrange'], ['arrange', 'front'], ['arrange', 'back']]);
  });

  it('marks an actions run button by its wrapper, leaving the button bare', () => {
    const { container } = render(withActions(<Bar schema={schema} onReorder={() => {}} />));
    const wrapper = container.querySelector('[data-bar-in="arrange"][data-bar-unit="front"]')!;
    expect(wrapper.tagName).toBe('SPAN');
    expect(wrapper.querySelector('button')).not.toHaveAttribute('data-bar-unit');
  });

  it('draws an actions run in its stored order', () => {
    render(withActions(<Bar schema={schema} order={{ arrange: ['back', 'front'] }} />));
    expect(names().slice(-2)).toEqual(['back', 'front']);
  });

  it('marks nothing without onReorder', () => {
    const { container } = render(withActions(<Bar schema={schema} order={{ '': ['b', 'a'] }} />));
    expect(container.querySelector('[data-bar-unit]')).toBeNull();
    expect(container.querySelector('[data-bar-in]')).toBeNull();
  });
});

describe('movedOrder', () => {
  const order = { g: ['p', 'q', 'r'] };
  it('moves an entry down', () => {
    expect(movedOrder(order, 'g', ['p', 'q', 'r'], 0, 2)).toEqual({ g: ['q', 'r', 'p'] });
  });
  it('moves an entry up', () => {
    expect(movedOrder(order, 'g', ['p', 'q', 'r'], 2, 0)).toEqual({ g: ['r', 'p', 'q'] });
  });
  it('leaves the order as it was for an index out of range', () => {
    expect(movedOrder(order, 'g', ['p', 'q', 'r'], 3, 0)).toBe(order);
    expect(movedOrder(order, 'g', ['p', 'q', 'r'], 0, 3)).toBe(order);
    expect(movedOrder(order, 'g', ['p', 'q', 'r'], -1, 0)).toBe(order);
  });
  it('sets a container with no prior entry, leaving the rest', () => {
    expect(movedOrder(order, 'h', ['x', 'y'], 1, 0)).toEqual({ g: ['p', 'q', 'r'], h: ['y', 'x'] });
  });
});
