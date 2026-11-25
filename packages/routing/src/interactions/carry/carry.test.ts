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
});
