import { describe, expect, it } from 'vitest';
import { mat3 } from '@weasel-js/geom';
import type { DrawCommand, GroupDrawCommand } from '../DrawCommand';
import { blur, vignette } from '../effects/builtins';
import { effectsWindow } from './groupEffects';

const BUFFER = { x: 0, y: 0, width: 400, height: 300 };
const rect = (x: number, y: number, width: number, height: number): DrawCommand => ({
  kind: 'path', path: { kind: 'rect', x, y, width, height }, fill: { paint: { color: '#fff' } },
});
const at = (g: Partial<GroupDrawCommand>, window = BUFFER) =>
  effectsWindow({ kind: 'group', children: [], ...g }, mat3.identity(), window, 400, 300, 1, 4096);

describe('effectsWindow', () => {
  it('covers a small blurred group and its reach, rounded up, inside the buffer', () => {
    const w = at({ effects: blur({ radius: 4 }), children: [rect(100, 100, 20, 10)] })!;
    expect(w).toEqual({ x: 91, y: 91, width: 64, height: 64 });
  });

  it('reaches past the buffer as far as the blur reads', () => {
    const w = at({ effects: blur({ radius: 4 }), children: [rect(-100, 10, 120, 10)] })!;
    expect(w.x).toBe(-8);
  });

  it('keeps a rounded window inside the buffer when the group was', () => {
    const w = at({ effects: blur({ radius: 4 }), children: [rect(370, 270, 10, 10)] })!;
    expect(w.x + w.width).toBe(400);
    expect(w.y + w.height).toBe(300);
  });

  it('is null when nothing reaches the window', () => {
    expect(at({ effects: blur({ radius: 4 }), children: [rect(-100, 10, 50, 10)] })).toBeNull();
  });

  it('runs an effect with no reach over the drawing buffer, whatever the window', () => {
    expect(at({ effects: vignette({ amount: 1 }), children: [rect(10, 10, 5, 5)] }, { x: 5, y: 5, width: 50, height: 50 }))
      .toEqual(BUFFER);
  });

  it('runs a composite that clears outside its group over the whole window', () => {
    expect(at({ composite: 'destination-in', children: [rect(10, 10, 5, 5)] })).toEqual(BUFFER);
  });
});
