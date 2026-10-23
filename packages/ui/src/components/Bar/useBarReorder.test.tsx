import { afterAll, afterEach, beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ActionsProvider, useAction, type Action } from '@weasel-js/core';
import { isApplePlatform } from '@weasel-js/gestures';
import type { PrefGroup, PrefLeaf, PrefOrder } from '@weasel-js/prefs';
import { Bar } from './Bar';

// jsdom lays nothing out: every marked unit is 40 px wide, side by side along x in document order, so a top-level
// cell and the buttons inside it stand at successive slots. Every other box is empty at the origin.
const realRect = Element.prototype.getBoundingClientRect;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box(this: Element) {
    const units = Array.from(this.ownerDocument.querySelectorAll('[data-bar-unit]'));
    const i = units.indexOf(this);
    const left = i < 0 ? 0 : i * 40;
    const width = i < 0 ? 0 : 40;
    return { x: left, y: 0, left, top: 0, right: left + width, bottom: 20, width, height: 20, toJSON: () => {} } as DOMRect;
  };
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
});
afterEach(cleanup);

const MOD = isApplePlatform() ? { metaKey: true } : { ctrlKey: true };

const act = (name: string): PrefLeaf => ({ kind: 'action', name, description: '', default: undefined, action: `x.${name}` }) as PrefLeaf;

function Register({ action }: { action: Action }) {
  useAction(action);
  return null;
}

const ran = vi.fn();
const reg = (id: string, group: string): Action => ({ id, label: id, group, invoker: { timing: 'immediate', run: () => ran(id) } });

const host = (node: ReactNode) => (
  <ActionsProvider>
    {['a', 'b', 'c', 'p', 'q'].map((n) => (
      <Register key={n} action={reg(`x.${n}`, 'x')} />
    ))}
    <Register action={reg('front', 'arrange')} />
    <Register action={reg('back', 'arrange')} />
    {node}
  </ActionsProvider>
);

const flat: PrefGroup = { name: 'Tools', children: { a: act('a'), b: act('b'), c: act('c') } };
const nested: PrefGroup = {
  name: 'Tools',
  children: {
    a: act('a'),
    b: act('b'),
    g: { name: 'G', as: 'section', children: { p: act('p'), q: act('q') } },
    arrange: { kind: 'actions', name: 'Arrange', description: '', default: undefined, group: 'arrange' } as PrefLeaf,
  },
};

const at = (x: number) => ({ pointerId: 1, button: 0, buttons: 1, pointerType: 'mouse', clientX: x, clientY: 10 });

/** Presses `el` at `from` with `mods`, moves to each of `path`, and releases at the last. */
function drag(el: Element, from: number, path: number[], mods: Record<string, boolean> = MOD) {
  fireEvent.pointerDown(el, { ...at(from), ...mods });
  for (const x of path) fireEvent.pointerMove(document, { ...at(x), ...mods });
  fireEvent.pointerUp(document, { ...at(path.at(-1) ?? from), buttons: 0, ...mods });
}

const button = (name: string) => screen.getByRole('button', { name });

describe('useBarReorder on a straight bar', () => {
  afterEach(() => {
    ran.mockClear();
  });

  it('a Cmd-drag from the first cell past the third moves it last', () => {
    const onReorder = vi.fn<(order: PrefOrder) => void>();
    render(host(<Bar schema={flat} onReorder={onReorder} />));
    drag(button('a'), 20, [40, 110]);
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith({ '': ['b', 'c', 'a'] });
  });

  it('swallows the click that follows a drag', () => {
    render(host(<Bar schema={flat} onReorder={() => {}} />));
    drag(button('a'), 20, [40, 110]);
    fireEvent.click(button('a'));
    expect(ran).not.toHaveBeenCalled();
  });

  it('a plain press, and a Cmd-press released without moving, reorder nothing, and the click reaches the button', () => {
    const onReorder = vi.fn();
    render(host(<Bar schema={flat} onReorder={onReorder} />));
    drag(button('a'), 20, [110], {});
    fireEvent.click(button('a'));
    drag(button('b'), 60, []);
    fireEvent.click(button('b'));
    expect(onReorder).not.toHaveBeenCalled();
    expect(ran.mock.calls).toEqual([['x.a'], ['x.b']]);
  });

  it('Escape mid-drag reorders nothing and clears the marks', () => {
    const onReorder = vi.fn();
    const { container } = render(host(<Bar schema={flat} onReorder={onReorder} />));
    fireEvent.pointerDown(button('a'), { ...at(20), ...MOD });
    fireEvent.pointerMove(document, { ...at(110), ...MOD });
    expect(container.querySelector('[data-bar-unit="a"]')).toHaveAttribute('data-bar-dragging');
    expect(container.querySelector('[data-bar-unit="c"]')).toHaveAttribute('data-bar-drop', 'after');
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerUp(document, { ...at(110), buttons: 0 });
    expect(onReorder).not.toHaveBeenCalled();
    expect(container.querySelector('[data-bar-dragging], [data-bar-drop]')).toBeNull();
  });

  it('marks the target before it when the drag runs back', () => {
    const { container } = render(host(<Bar schema={flat} onReorder={() => {}} />));
    fireEvent.pointerDown(button('c'), { ...at(100), ...MOD });
    fireEvent.pointerMove(document, { ...at(10), ...MOD });
    expect(container.querySelector('[data-bar-unit="a"]')).toHaveAttribute('data-bar-drop', 'before');
    fireEvent.keyDown(window, { key: 'Escape' });
  });

  it('Cmd+Shift on an item in a group moves the group among the top-level units', () => {
    const onReorder = vi.fn();
    render(host(<Bar schema={nested} onReorder={onReorder} />));
    // a 0..40, b 40..80, g's p and q 80..160, arrange 160..200 with its buttons after it: past arrange's middle.
    drag(button('p'), 100, [150, 190], { ...MOD, shiftKey: true });
    expect(onReorder).toHaveBeenCalledWith({ '': ['a', 'b', 'arrange', 'g'] });
  });

  it('a Cmd-drag on an item in a group moves it inside the group only', () => {
    const onReorder = vi.fn();
    render(host(<Bar schema={nested} order={{ g: ['p', 'q'] }} onReorder={onReorder} />));
    drag(button('q'), 140, [100, 30]);
    expect(onReorder).toHaveBeenCalledWith({ g: ['q', 'p'] });
  });

  it('a Cmd-drag inside an actions run reorders only that run', () => {
    const onReorder = vi.fn();
    render(host(<Bar schema={nested} onReorder={onReorder} />));
    // front at 200..240, back at 240..280.
    drag(button('front'), 220, [250, 270]);
    expect(onReorder).toHaveBeenCalledWith({ arrange: ['back', 'front'] });
  });

  it('does not capture the pointer at the press', () => {
    // A proxy: jsdom's setPointerCapture retargets nothing, so the click a capture at the press would cost cannot be
    // seen here. That nothing captured until the press became a drag is what keeps that click on the button.
    const proto = Element.prototype as { setPointerCapture?: (id: number) => void };
    const real = proto.setPointerCapture;
    const capture = vi.fn();
    proto.setPointerCapture = capture;
    onTestFinished(() => {
      proto.setPointerCapture = real;
    });
    render(host(<Bar schema={flat} onReorder={() => {}} />));
    fireEvent.pointerDown(button('a'), { ...at(20), ...MOD });
    expect(capture).not.toHaveBeenCalled();
    fireEvent.pointerMove(document, { ...at(110), ...MOD });
    expect(capture).toHaveBeenCalledWith(1);
    fireEvent.pointerUp(document, { ...at(110), buttons: 0 });
  });
});
