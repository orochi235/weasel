import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Along } from './index';
import { useRun, type Run } from '../Run';

// jsdom lays nothing out: every box is `size` square untransformed, and a test can switch it.
let size = 200;
const real = ['offsetWidth', 'offsetHeight'].map((k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)!] as const);
beforeAll(() => {
  for (const [k] of real) Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => size });
});
afterAll(() => { for (const [k, d] of real) Object.defineProperty(HTMLElement.prototype, k, d); });

describe('Along', () => {
  it('hands its descendants an arc sized from its own box', () => {
    size = 200;
    let seen = null as Run | null;
    const Probe = () => { seen = useRun(); return null; };
    render(<Along arc={{ start: 300, end: 60 }}><Probe /></Along>);
    expect(seen!.shape!.kind).toBe('arc');
    expect(seen!.shape!.length).toBeCloseTo((100 * 2 * Math.PI) / 3);
    expect(seen!.align).toBe('center');
  });

  it('gives no shape outside an Along', () => {
    let seen = null as Run | null;
    const Probe = () => { seen = useRun(); return null; };
    render(<Probe />);
    expect(seen!.shape).toBeUndefined();
  });

  it('places everything at the center of a 0 by 0 box, never NaN', () => {
    size = 0;
    let seen = null as Run | null;
    const Probe = () => { seen = useRun(); return null; };
    render(<Along><Probe /></Along>);
    const { point } = seen!.shape!.at(0.5);
    expect(point).toEqual({ x: 0, y: 0 });
    expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
  });
});
