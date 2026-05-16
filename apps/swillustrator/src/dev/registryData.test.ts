import { describe, it, expect } from 'vitest';
import {
  collectIcons,
  collectBundles,
  collectOpFactories,
  collectPublicExports,
} from './registryData';

describe('registryData static collectors', () => {
  it('collectIcons returns named entries for action and kind icons', () => {
    const icons = collectIcons();
    expect(icons.length).toBeGreaterThan(10);
    const names = icons.map((i) => i.id);
    expect(names).toContain('DeleteIcon');
    expect(names).toContain('PageIcon');
    for (const i of icons) {
      expect(i.kind).toBe('icon');
      expect(typeof i.Component).toBe('function');
    }
  });

  it('collectBundles returns the three named tool bundles', () => {
    const bundles = collectBundles();
    expect(bundles.map((b) => b.id)).toEqual(['minimal', 'standard', 'exhaustive']);
    const exhaustive = bundles.find((b) => b.id === 'exhaustive')!;
    expect(exhaustive.tools).toContain('rect');
    expect(exhaustive.tools).toContain('ellipse');
  });

  it('collectOpFactories returns named op factories from the kit barrel', () => {
    const ops = collectOpFactories();
    const ids = ops.map((o) => o.id);
    expect(ids).toContain('createInsertOp');
    expect(ids).toContain('createDeleteOp');
    expect(ids).toContain('createTransformOp');
  });

  it('collectPublicExports returns a non-empty list', () => {
    const exports = collectPublicExports();
    expect(exports.length).toBeGreaterThan(20);
  });
});
