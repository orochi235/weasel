import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { ActionsProvider, useAction, type Action } from '@weasel-js/core';
import type { PrefGroup, PrefLeaf, PrefOrder } from '@weasel-js/prefs';
import { Bar } from './Bar';

afterEach(cleanup);

const act = (name: string): PrefLeaf => ({ kind: 'action', name, description: '', default: undefined, action: `x.${name}` }) as PrefLeaf;
const num = (name: string): PrefLeaf => ({ kind: 'number', name, description: '', default: 1 }) as PrefLeaf;

function Register({ action }: { action: Action }) {
  useAction(action);
  return null;
}

const host = (node: ReactNode) => (
  <ActionsProvider>
    {['a', 'b', 'c', 'p', 'q'].map((n) => (
      <Register key={n} action={{ id: `x.${n}`, label: n, group: 'x', invoker: { timing: 'immediate', run: () => {} } }} />
    ))}
    {node}
  </ActionsProvider>
);

const flat: PrefGroup = { name: 'Tools', children: { a: act('a'), b: act('b'), c: act('c') } };
const nested: PrefGroup = {
  name: 'Tools',
  children: { a: act('a'), g: { name: 'G', as: 'section', children: { p: act('p'), q: act('q') } }, c: act('c') },
};
const withNumber: PrefGroup = { name: 'Tools', children: { a: act('a'), n: num('n'), c: act('c') } };

const button = (name: string) => screen.getByRole('button', { name });
const alt = (el: Element, key: string, more: Record<string, boolean> = {}) => fireEvent.keyDown(el, { key, altKey: true, ...more });

/** A bar that keeps the order it is told of, as a host would. */
function Held({ schema, onReorder }: { schema: PrefGroup; onReorder: (o: PrefOrder) => void }) {
  const [order, setOrder] = useState<PrefOrder>();
  return (
    <Bar
      schema={schema}
      order={order}
      onReorder={(o) => {
        setOrder(o);
        onReorder(o);
      }}
    />
  );
}

describe('Alt+arrow reordering', () => {
  it('Alt+Right on the first of three moves it second and keeps focus on it', () => {
    const onReorder = vi.fn();
    render(host(<Held schema={flat} onReorder={onReorder} />));
    button('a').focus();
    alt(button('a'), 'ArrowRight');
    expect(onReorder).toHaveBeenCalledWith({ '': ['b', 'a', 'c'] });
    expect(button('a')).toHaveFocus();
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['b', 'a', 'c']);
  });

  it('announces the new position', () => {
    render(host(<Held schema={flat} onReorder={() => {}} />));
    button('a').focus();
    alt(button('a'), 'ArrowRight');
    const say = document.querySelector('[data-bar-announce]');
    expect(say).toHaveTextContent('a, 2 of 3');
    expect(say).toHaveAttribute('aria-live', 'polite');
    expect(say).toHaveAttribute('aria-atomic', 'true');
    // A role of status would collide with an app's own status bar.
    expect(say).not.toHaveAttribute('role');
  });

  it('does nothing and says nothing at either end', () => {
    const onReorder = vi.fn();
    render(host(<Bar schema={flat} onReorder={onReorder} />));
    alt(button('a'), 'ArrowLeft');
    alt(button('c'), 'ArrowRight');
    expect(onReorder).not.toHaveBeenCalled();
    expect(document.querySelector('[data-bar-announce]')).toHaveTextContent('');
  });

  it('leaves Alt+Arrow alone inside a number input', () => {
    const onReorder = vi.fn();
    render(host(<Bar schema={withNumber} onReorder={onReorder} />));
    alt(screen.getByRole('spinbutton'), 'ArrowRight');
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('Alt+Shift+Right moves the group among its siblings', () => {
    const onReorder = vi.fn();
    render(host(<Bar schema={nested} onReorder={onReorder} />));
    alt(button('p'), 'ArrowRight', { shiftKey: true });
    expect(onReorder).toHaveBeenCalledWith({ '': ['a', 'c', 'g'] });
  });

  it('Alt+Right on an item in a group moves it inside the group only', () => {
    const onReorder = vi.fn();
    render(host(<Bar schema={nested} onReorder={onReorder} />));
    alt(button('p'), 'ArrowRight');
    expect(onReorder).toHaveBeenCalledWith({ g: ['q', 'p'] });
  });

  it('a vertical bar answers to Alt+Up and Down, not Left and Right', () => {
    const onReorder = vi.fn();
    render(host(<Bar schema={flat} orientation="vertical" onReorder={onReorder} />));
    alt(button('b'), 'ArrowRight');
    expect(onReorder).not.toHaveBeenCalled();
    alt(button('b'), 'ArrowUp');
    expect(onReorder).toHaveBeenCalledWith({ '': ['b', 'a', 'c'] });
  });

  it('names its shortcuts on each unit, by orientation', () => {
    const { rerender } = render(host(<Bar schema={flat} onReorder={() => {}} />));
    expect(button('a')).toHaveAttribute('aria-keyshortcuts', 'Alt+ArrowLeft Alt+ArrowRight');
    rerender(host(<Bar schema={flat} orientation="vertical" onReorder={() => {}} />));
    expect(button('a')).toHaveAttribute('aria-keyshortcuts', 'Alt+ArrowUp Alt+ArrowDown');
  });

  it('draws no announcer and no shortcuts without onReorder', () => {
    render(host(<Bar schema={flat} />));
    expect(document.querySelector('[data-bar-announce]')).toBeNull();
    expect(button('a')).not.toHaveAttribute('aria-keyshortcuts');
  });

  it('keeps the place of a child nothing draws', () => {
    const schema: PrefGroup = { name: 'Tools', children: { a: act('a'), b: { ...act('b'), hidden: true } as PrefLeaf, c: act('c') } };
    const onReorder = vi.fn();
    render(host(<Bar schema={schema} onReorder={onReorder} />));
    alt(button('a'), 'ArrowRight');
    expect(onReorder).toHaveBeenCalledWith({ '': ['b', 'c', 'a'] });
  });
});
