import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Along, useTrackShape, type AlongCtx } from './index';

// jsdom lays nothing out: every box is `size` square, and a test can switch it.
let size = 200;
const real = Element.prototype.getBoundingClientRect;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box() {
    return { x: 0, y: 0, left: 0, top: 0, right: size, bottom: size, width: size, height: size, toJSON: () => {} } as DOMRect;
  };
});
afterAll(() => { Element.prototype.getBoundingClientRect = real; });

describe('Along', () => {
  it('hands its descendants an arc sized from its own box', () => {
    size = 200;
    let seen = null as AlongCtx | null;
    const Probe = () => { seen = useTrackShape(); return null; };
    render(<Along arc={{ start: 300, end: 60 }}><Probe /></Along>);
    expect(seen!.shape.kind).toBe('arc');
    expect(seen!.shape.length).toBeCloseTo((100 * 2 * Math.PI) / 3);
    expect(seen!.align).toBe('center');
  });

  it('gives no shape outside an Along', () => {
    let seen = undefined as AlongCtx | null | undefined;
    const Probe = () => { seen = useTrackShape(); return null; };
    render(<Probe />);
    expect(seen).toBeNull();
  });

  it('places everything at the center of a 0 by 0 box, never NaN', () => {
    size = 0;
    let seen = null as AlongCtx | null;
    const Probe = () => { seen = useTrackShape(); return null; };
    render(<Along><Probe /></Along>);
    const { point } = seen!.shape.at(0.5);
    expect(point).toEqual({ x: 0, y: 0 });
    expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
  });
});
