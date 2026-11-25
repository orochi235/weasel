import { afterEach, describe, expect, it, vi } from 'vitest';
import { addCarrySurface, startCarry, type CarryStage } from './carry';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

/** A surface covering the whole viewport, logging what it hears. */
function surface(): CarryStage[] {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1000, bottom: 1000, x: 0, y: 0, width: 1000, height: 1000, toJSON: () => ({}) });
  document.body.append(el);
  const heard: CarryStage[] = [];
  const off = addCarrySurface({ element: el, receive: (stage) => { heard.push(stage); return 'handled'; } });
  cleanups.push(() => { off(); el.remove(); });
  return heard;
}

const move = (buttons: number) =>
  new PointerEvent('pointermove', { pointerId: 3, bubbles: true, buttons, clientX: 50, clientY: 50 });

describe('startCarry', () => {

  it('cancels on a window blur', () => {
    surface();
    const origin = document.createElement('button');
    document.body.append(origin);
    cleanups.push(() => origin.remove());
    const onCancel = vi.fn();
    startCarry(origin, new PointerEvent('pointerdown', { pointerId: 3, buttons: 1 }), { type: 't', value: 1 }, { onCancel });
    window.dispatchEvent(new Event('blur'));
    expect(onCancel).toHaveBeenCalledWith('blur');
  });

  it('drops nothing on a release the document never saw, and reports a cancel', () => {
    const heard = surface();
    const origin = document.createElement('button');
    document.body.append(origin);
    cleanups.push(() => origin.remove());
    const onEnd = vi.fn();
    const onCancel = vi.fn();
    startCarry(origin, new PointerEvent('pointerdown', { pointerId: 3, buttons: 1, clientX: 40, clientY: 40 }), { type: 't', value: 1 }, { onEnd, onCancel });
    document.dispatchEvent(move(1));
    document.dispatchEvent(move(0));
    expect(heard).toEqual(['enter', 'leave']);
    expect(onEnd).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledWith('missedrelease');
  });

  it('drops nothing past the window edge, where the page hit-tests nothing, over a surface that runs past it', () => {
    const heard = surface();
    document.elementFromPoint = (x: number, y: number) => (x >= 0 && y >= 0 && x < 100 && y < 100 ? document.body : null);
    const origin = document.createElement('button');
    document.body.append(origin);
    cleanups.push(() => { origin.remove(); delete (document as { elementFromPoint?: unknown }).elementFromPoint; });
    const onEnd = vi.fn();
    startCarry(origin, new PointerEvent('pointerdown', { pointerId: 3, buttons: 1, clientX: 40, clientY: 40 }), { type: 't', value: 1 }, { onEnd });
    document.dispatchEvent(new PointerEvent('pointermove', { pointerId: 3, bubbles: true, buttons: 1, clientX: 500, clientY: 50 }));
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3, bubbles: true, clientX: 500, clientY: 50 }));
    expect(heard).not.toContain('drop');
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('carries over a surface inside a shadow root, which the document hit-tests as the host', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1000, bottom: 1000, x: 0, y: 0, width: 1000, height: 1000, toJSON: () => ({}) });
    shadow.append(el);
    document.elementFromPoint = () => host;
    (shadow as { elementFromPoint?: unknown }).elementFromPoint = () => el;
    const heard: CarryStage[] = [];
    const off = addCarrySurface({ element: el, receive: (stage) => { heard.push(stage); return 'handled'; } });
    const origin = document.createElement('button');
    document.body.append(origin);
    cleanups.push(() => { off(); host.remove(); origin.remove(); delete (document as { elementFromPoint?: unknown }).elementFromPoint; });
    const carry = startCarry(origin, new PointerEvent('pointerdown', { pointerId: 3, buttons: 1, clientX: 40, clientY: 40 }), { type: 't', value: 1 });
    cleanups.push(() => carry.cancel());
    document.dispatchEvent(move(1));
    expect(heard).toEqual(['enter']);
  });
  it('carries over a surface in a shadow root inside another surface, whichever registered first', () => {
    const full = () => ({ left: 0, top: 0, right: 1000, bottom: 1000, x: 0, y: 0, width: 1000, height: 1000, toJSON: () => ({}) });
    const outer = document.createElement('div');
    outer.getBoundingClientRect = full;
    const host = document.createElement('div');
    outer.append(host);
    document.body.append(outer);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('div');
    inner.getBoundingClientRect = full;
    shadow.append(inner);
    document.elementFromPoint = () => host;
    (shadow as { elementFromPoint?: unknown }).elementFromPoint = () => inner;
    const heard: string[] = [];
    const offInner = addCarrySurface({ element: inner, receive: (stage) => { heard.push(`inner ${stage}`); return 'handled'; } });
    const offOuter = addCarrySurface({ element: outer, receive: (stage) => { heard.push(`outer ${stage}`); return 'handled'; } });
    const origin = document.createElement('button');
    document.body.append(origin);
    cleanups.push(() => { offInner(); offOuter(); outer.remove(); origin.remove(); delete (document as { elementFromPoint?: unknown }).elementFromPoint; });
    const carry = startCarry(origin, new PointerEvent('pointerdown', { pointerId: 3, buttons: 1, clientX: 40, clientY: 40 }), { type: 't', value: 1 });
    cleanups.push(() => carry.cancel());
    document.dispatchEvent(move(1));
    expect(heard).toEqual(['inner enter']);
  });
});
