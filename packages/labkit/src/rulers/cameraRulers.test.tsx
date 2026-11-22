/**
 * Rulers on a labkit camera: a drag off a strip places a guide through the camera's own dispatcher, as one step of
 * the trial's undo, only while the trial shows the rulers; and snapping reads the instrument's world through the
 * frame.
 */

import { act, render } from '@testing-library/react';
import type { Op } from '@weasel-js/core';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CanvasStack } from '../canvas/CanvasStack';
import type { WorldSpec } from '../canvas/worldSpec';
import type { Instrument, ViewTransform2D } from '../instrument/types';
import { useTrialRulersPart } from './rulersPart';
import { type TrialGuides, useTrialGuides } from './trialGuides';

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

function drag(el: Element, from: { x: number; y: number }, to: { x: number; y: number }) {
  act(() => {
    pointer(el, 'pointerdown', from.x, from.y);
    pointer(el, 'pointermove', (from.x + to.x) / 2, (from.y + to.y) / 2);
    pointer(el, 'pointermove', to.x, to.y);
    pointer(el, 'pointerup', to.x, to.y, 0);
  });
}

function mount(worldSpec?: WorldSpec) {
  const recorded: { event: string; op: Op | undefined }[] = [];
  const views: ViewTransform2D[] = [];
  const out: { guides: TrialGuides | null } = { guides: null };
  const instrument = {
    name: 'ruled',
    canvas: { layers: [], rulers: true, ...(worldSpec ? { worldSpec } : {}) },
    render: () => null,
  } as unknown as Instrument;
  function Host() {
    const [view, setView] = useState<ViewTransform2D>({ zoom: 1, pan: { x: 0, y: 0 } });
    const guides = useTrialGuides((event, op) => {
      recorded.push({ event, op });
      return true;
    });
    out.guides = guides;
    const part = useTrialRulersPart(instrument, guides, view);
    return (
      <CanvasStack
        layers={[]}
        view={view}
        onViewChange={(v) => {
          views.push(v);
          setView(v);
        }}
        worldSpec={worldSpec}
        contributions={part?.contributions}
      >
        {part?.chrome}
      </CanvasStack>
    );
  }
  const { container } = render(<Host />);
  const host = container.querySelector('.lk-canvas-stack') as HTMLElement;
  const guides = () => {
    if (!out.guides) throw new Error('not mounted');
    return out.guides;
  };
  return { host, guides, recorded, views };
}

describe('rulers on a labkit camera', () => {
  it('offers the rulers to the trial, all of it off', () => {
    const { guides } = mount();
    expect(guides().offered).toBe(true);
    expect(guides().shown).toEqual({ rulers: false, guides: false, snap: false });
  });

  it('pans on a drag along the top while the rulers are hidden', () => {
    const { host, guides, views } = mount();
    drag(host, { x: 100, y: 10 }, { x: 120, y: 80 });
    expect(guides().getGuides()).toEqual([]);
    expect(views.length).toBeGreaterThan(0);
  });

  it('places a guide dragged off the top ruler, shows the guides, and records one undo step', () => {
    const { host, guides, recorded, views } = mount();
    act(() => guides().toggle('rulers'));
    drag(host, { x: 100, y: 10 }, { x: 120, y: 80 });
    expect(views).toEqual([]);
    expect(guides().getGuides()).toMatchObject([{ axis: 'y', offset: 80 }]);
    expect(guides().shown.guides).toBe(true);
    expect(recorded.map((r) => r.event)).toEqual(['guides.change']);
    const step = recorded[0]?.op;
    act(() => {
      step?.invert().apply(undefined);
    });
    expect(guides().getGuides()).toEqual([]);
  });

  it('moves a placed guide, and removes one dropped back on a ruler', () => {
    const { host, guides } = mount();
    act(() => guides().toggle('rulers'));
    drag(host, { x: 100, y: 10 }, { x: 120, y: 80 });
    drag(host, { x: 200, y: 80 }, { x: 200, y: 140 });
    expect(guides().getGuides()).toMatchObject([{ axis: 'y', offset: 140 }]);
    drag(host, { x: 200, y: 140 }, { x: 200, y: 5 });
    expect(guides().getGuides()).toEqual([]);
  });

  it('leaves a hidden guide where it is, and pans instead', () => {
    const { host, guides, views } = mount();
    act(() => guides().toggle('rulers'));
    drag(host, { x: 100, y: 10 }, { x: 120, y: 80 });
    act(() => guides().toggle('guides'));
    drag(host, { x: 200, y: 80 }, { x: 200, y: 140 });
    expect(guides().getGuides()).toMatchObject([{ axis: 'y', offset: 80 }]);
    expect(views.length).toBeGreaterThan(0);
  });

  it('snaps a point in a y-up world onto a guide, only while snapping is on', () => {
    const { host, guides } = mount({ yAxis: 'up' });
    act(() => guides().toggle('rulers'));
    drag(host, { x: 100, y: 10 }, { x: 120, y: 80 });
    // The guide sits 80 px down the screen: world y -80 in a y-up world.
    expect(guides().snap({ x: 5, y: -78 })).toEqual({ x: 5, y: -78 });
    act(() => guides().toggle('snap'));
    expect(guides().snap({ x: 5, y: -78 })).toEqual({ x: 5, y: -80 });
    expect(guides().snap({ x: 5, y: -40 })).toEqual({ x: 5, y: -40 });
  });
});
