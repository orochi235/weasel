import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Slider, type ThumbRenderCtx, type TrackCtx } from './index';

// jsdom lays nothing out: a thumb is 10 by 20 here, and everything else 300 by 6.
const size = (el: Element) => (el.getAttribute('role') === 'slider' ? [10, 20] : [300, 6]) as [number, number];
const real = Element.prototype.getBoundingClientRect;
const proto = HTMLElement.prototype;
const realW = Object.getOwnPropertyDescriptor(proto, 'offsetWidth')!;
const realH = Object.getOwnPropertyDescriptor(proto, 'offsetHeight')!;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box(this: Element) {
    const [width, height] = size(this);
    return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => {} } as DOMRect;
  };
  Object.defineProperty(proto, 'offsetWidth', { configurable: true, get(this: Element) { return size(this)[0]; } });
  Object.defineProperty(proto, 'offsetHeight', { configurable: true, get(this: Element) { return size(this)[1]; } });
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = real;
  Object.defineProperty(proto, 'offsetWidth', realW);
  Object.defineProperty(proto, 'offsetHeight', realH);
});

describe('Slider render contexts', () => {
  function setup() {
    const seen: ThumbRenderCtx[][] = [[], []];
    const tracks: TrackCtx[] = [];
    const thumb = (i: number, value: number) => ({
      value,
      label: `t${i}`,
      shape: { render: (ctx: ThumbRenderCtx) => { seen[i]!.push(ctx); return null; } },
    });
    render(
      <Slider
        min={0}
        max={100}
        thumbs={[thumb(0, 20), thumb(1, 80)]}
        onInput={() => {}}
        renderTrack={(ctx) => { tracks.push(ctx); return null; }}
      />,
    );
    return { seen, tracks, thumbs: screen.getAllByRole('slider') };
  }

  it('hands a custom thumb the box it is laid out in', () => {
    const { seen } = setup();
    expect(seen[0]!.at(-1)).toMatchObject({ width: 10, height: 20 });
  });

  it('tells the dragged thumb it is active, and only while it is dragged', () => {
    const { seen, thumbs } = setup();
    expect(seen[1]!.at(-1)!.isActive).toBe(false);
    fireEvent.pointerDown(thumbs[1]!, { clientX: 240, pointerId: 1 });
    expect(seen[1]!.at(-1)!.isActive).toBe(true);
    expect(seen[0]!.at(-1)!.isActive).toBe(false);
    fireEvent.pointerUp(document, { clientX: 240, pointerId: 1 });
    expect(seen[1]!.at(-1)!.isActive).toBe(false);
  });

  it('hands the track painter the track\'s width from its first paint', () => {
    const { tracks } = setup();
    expect(tracks.at(-1)!.trackWidth).toBe(300);
  });
});
