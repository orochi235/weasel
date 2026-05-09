import { describe, it, expect } from 'vitest';
import type { Paint, GradStop } from '@orochi235/weasel';

describe('Paint gradient types (compile-time + runtime shape)', () => {
  it('GradStop has offset and color fields', () => {
    const stop: GradStop = { offset: 0.5, color: '#ff0000' };
    expect(stop.offset).toBe(0.5);
    expect(stop.color).toBe('#ff0000');
  });

  it('linear-gradient Paint discriminates on fill', () => {
    const p: Paint = {
      fill: 'linear-gradient',
      from: { x: 0, y: 0 },
      to: { x: 100, y: 0 },
      stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
    };
    expect(p.fill).toBe('linear-gradient');
  });

  it('radial-gradient Paint discriminates on fill', () => {
    const p: Paint = {
      fill: 'radial-gradient',
      center: { x: 50, y: 50 },
      radius: 50,
      stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }],
    };
    expect(p.fill).toBe('radial-gradient');
  });

  it('conic-gradient Paint discriminates on fill', () => {
    const p: Paint = {
      fill: 'conic-gradient',
      center: { x: 50, y: 50 },
      angle: 0,
      stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }],
    };
    expect(p.fill).toBe('conic-gradient');
  });

  it('pattern Paint discriminates on fill', () => {
    const p: Paint = {
      fill: 'pattern',
      pattern: {} as CanvasPattern,
    };
    expect(p.fill).toBe('pattern');
  });
});
