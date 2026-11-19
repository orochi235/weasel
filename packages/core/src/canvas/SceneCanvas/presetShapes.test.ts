import { describe, it, expect } from 'vitest';
import type { NodeShapeEntry } from '../NodeShape';
import { presetShapes } from './presetTraits';

const painter = { kind: 'text' } as unknown as NodeShapeEntry<never, never>;

describe('presetShapes', () => {
  it('installs a painter two presets give once', () => {
    const out = presetShapes([{ id: 'a', shapes: [painter] }, { id: 'b', shapes: [{ painter, priority: 'normal' }] }]);
    expect(out).toHaveLength(1);
  });

  it('throws when two presets install one painter at different priorities', () => {
    expect(() => presetShapes([{ id: 'a', shapes: [painter] }, { id: 'b', shapes: [{ painter, priority: 'high' }] }]))
      .toThrow(/"a" and "b"/);
  });
});
