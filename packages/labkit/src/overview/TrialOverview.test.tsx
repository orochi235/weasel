/**
 * A trial's overview: a press in it moves the stage's camera there, and the
 * pointer over it is published as the overview's, which the stage then draws.
 *
 * jsdom lays nothing out, so every rect measures zero: a client point is
 * already box-relative, and the stage's viewport has no size to center in —
 * centering puts the pressed world point at the stage's origin instead.
 */

import { act, render } from '@testing-library/react';
import type { PointerContextValue } from '@weasel-js/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { TrialOverview } from './TrialOverview';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.hasPointerCapture = vi.fn(() => true);
});

function pointer(el: Element, type: string, x: number, y: number, buttons = 1) {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      clientX: x,
      clientY: y,
      button: 0,
      buttons,
    }),
  );
}

/** Content 400×300 in a 200×150 box, 6px in: scale 0.46, so box (100, 75)
 *  is content (200, 150). */
function mount() {
  let store: PointerContextValue | null = null;
  const pictured = defineInstrument<Record<string, never>, Record<string, never>>({
    name: 'Pictured',
    defaultConfig: () => ({}),
    initialState: () => ({}),
    render: (ctx) => {
      store = ctx.trial.pointer;
      return <div data-testid="picture" />;
    },
    stage: {
      size: { width: 400, height: 300 },
      overlay: () => (
        <TrialOverview width={200} height={150} render={() => <div data-testid="thumb" />} />
      ),
    },
  });
  const r = render(<Lab instruments={[pictured]} defaultInstrument="Pictured" />);
  const box = r.container.querySelector('.lk-overview__box');
  const content = r.container.querySelector('.lk-stage__content') as HTMLElement | null;
  if (!box || !content) throw new Error('no overview or stage');
  return { ...r, box, content, store: () => store as PointerContextValue | null };
}

const px = (el: HTMLElement, name: string) => Number.parseFloat(el.style.getPropertyValue(name));

describe('<TrialOverview>', () => {
  it('draws the instrument-supplied content, not the instrument itself', () => {
    const h = mount();
    expect(h.box.querySelector('[data-testid="thumb"]')).not.toBeNull();
    expect(h.box.querySelector('[data-testid="picture"]')).toBeNull();
  });

  it('moves the stage camera to the pressed point', () => {
    const h = mount();
    act(() => {
      pointer(h.box, 'pointerdown', 100, 75);
      pointer(h.box, 'pointerup', 100, 75, 0);
    });
    expect(px(h.content, '--lk-stage-x')).toBeCloseTo(-200);
    expect(px(h.content, '--lk-stage-y')).toBeCloseTo(-150);
  });

  it('follows a drag with the camera, and never pans the stage by it', () => {
    const h = mount();
    act(() => {
      pointer(h.box, 'pointerdown', 100, 75);
      pointer(h.box, 'pointermove', 110, 75);
      pointer(h.box, 'pointermove', 123, 75);
      pointer(h.box, 'pointerup', 123, 75, 0);
    });
    // Box x 123 is content x 250 — a stage pan by the 23px drag would land
    // elsewhere.
    expect(px(h.content, '--lk-stage-x')).toBeCloseTo(-250);
  });

  it("publishes the pointer over it as the overview's, and the stage draws it", () => {
    const h = mount();
    act(() => pointer(h.box, 'pointermove', 100, 75, 0));
    const p = h.store()?.get();
    expect(p?.viewId).toBe('overview');
    expect(p?.worldX).toBeCloseTo(200);
    expect(p?.worldY).toBeCloseTo(150);
    expect(h.container.querySelector('.lk-stage .lk-linked-cursor')).not.toBeNull();
  });

  it("publishes the stage's pointer as the stage's, so the stage draws none", () => {
    const h = mount();
    const host = h.container.querySelector('.lk-stage') as HTMLElement;
    act(() => pointer(host, 'pointermove', 10, 10, 0));
    expect(h.store()?.get()?.viewId).toBe('stage');
    expect(h.container.querySelector('.lk-stage .lk-linked-cursor')).toBeNull();
  });
});
