import { describe, it, expect } from 'vitest';
import type { Paint, GradStop } from '@weasel-js/paint';

describe('Paint gradient types (compile-time + runtime shape)', () => {
  it('GradStop has offset and color fields', () => {
    const stop: GradStop = { offset: 0.5, color: '#ff0000' };
    expect(stop.offset).toBe(0.5);
    expect(stop.color).toBe('#ff0000');
  });

  it('linear-gradient Paint discriminates on fill', () => {
    const p: Paint = {
      kind: 'linear-gradient',
      from: { x: 0, y: 0 },
      to: { x: 100, y: 0 },
      stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
    };
    expect(p.kind).toBe('linear-gradient');
  });

  it('radial-gradient Paint discriminates on fill', () => {
    const p: Paint = {
      kind: 'radial-gradient',
      center: { x: 50, y: 50 },
      radius: 50,
      stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }],
    };
    expect(p.kind).toBe('radial-gradient');
  });

  it('conic-gradient Paint discriminates on fill', () => {
    const p: Paint = {
      kind: 'conic-gradient',
      center: { x: 50, y: 50 },
      angle: 0,
      stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }],
    };
    expect(p.kind).toBe('conic-gradient');
  });

  it('a pattern Paint is a tile kind or a texture', () => {
    const tile: Paint = { kind: 'hatch', color: '#000' };
    const texture: Paint = { kind: 'texture', texture: { id: 'test-tex' } };
    expect(tile.kind).toBe('hatch');
    expect(texture.kind).toBe('texture');
  });
});
