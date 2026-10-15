import { afterEach, describe, expect, it } from 'vitest';
import { heldPointers, type HeldPointers } from './heldPointers';

const readers: HeldPointers[] = [];
function read(element: Element): HeldPointers {
  const r = heldPointers(element);
  readers.push(r);
  return r;
}
function mount(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}
const send = (target: EventTarget, type: string, init: PointerEventInit = {}): void => {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, ...init }));
};

afterEach(() => {
  for (const r of readers.splice(0)) r.release();
  document.body.replaceChildren();
});

describe('heldPointers', () => {
  it('counts a press on the element until its release, wherever that lands', () => {
    const el = mount();
    const held = read(el);
    expect(held.count()).toBe(0);
    send(el, 'pointerdown');
    expect(held.count()).toBe(1);
    send(document.body, 'pointerup');
    expect(held.count()).toBe(0);
  });

  it('counts a press with any button, and one inside a child', () => {
    const el = mount();
    const child = el.appendChild(document.createElement('button'));
    const held = read(el);
    send(child, 'pointerdown', { button: 2, buttons: 2 });
    expect(held.count()).toBe(1);
  });

  it('keeps counting while one of two pointers is still down', () => {
    const el = mount();
    const held = read(el);
    send(el, 'pointerdown', { pointerId: 1 });
    send(el, 'pointerdown', { pointerId: 2 });
    send(el, 'pointerup', { pointerId: 1 });
    expect(held.count()).toBe(1);
    send(el, 'pointercancel', { pointerId: 2 });
    expect(held.count()).toBe(0);
  });

  it('ignores a press that began outside the element', () => {
    const el = mount();
    const held = read(el);
    send(document.body, 'pointerdown');
    expect(held.count()).toBe(0);
  });

  it('reads a move with no button held as the release it never saw', () => {
    const el = mount();
    const held = read(el);
    send(el, 'pointerdown', { buttons: 1 });
    send(document.body, 'pointermove', { buttons: 1 });
    expect(held.count()).toBe(1);
    send(document.body, 'pointermove', { buttons: 0 });
    expect(held.count()).toBe(0);
  });

  it('does not read a missed release out of a press that reported no buttons', () => {
    const el = mount();
    const held = read(el);
    send(el, 'pointerdown');
    send(el, 'pointermove');
    expect(held.count()).toBe(1);
  });

  it('drops every hold when the window loses focus', () => {
    const el = mount();
    const held = read(el);
    send(el, 'pointerdown');
    window.dispatchEvent(new Event('blur'));
    expect(held.count()).toBe(0);
  });

  it('gives every reader of an element the same answer, until the last lets go', () => {
    const el = mount();
    const a = read(el);
    const b = read(el);
    send(el, 'pointerdown');
    expect([a.count(), b.count()]).toEqual([1, 1]);
    a.release();
    send(el, 'pointerup');
    expect(b.count()).toBe(0);
    b.release();
    send(el, 'pointerdown');
    expect(b.count()).toBe(0);
  });
});
