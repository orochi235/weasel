import { describe, it, expect } from 'vitest';
import {
  collectIcons,
  collectBundles,
  collectRoutingKinds,
  collectOpFactories,
  collectShapeKinds,
} from './registryData';
import { defaultNodeKinds, type NodeKind } from '@orochi235/weasel';

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

  it('collectShapeKinds returns the built-in shape kind ids', () => {
    const kinds = collectShapeKinds();
    const ids = kinds.map((k) => k.id);
    expect(ids).toContain('rect');
    expect(ids).toContain('ellipse');
    expect(ids).toContain('polygon');
    for (const k of kinds) {
      expect(k.kind).toBe('shapeKind');
    }
  });
});

describe('collectShapeKinds — facet tag', () => {
  it('tags every entry with facet: shape', () => {
    const entries = collectShapeKinds();
    for (const entry of entries) {
      expect(entry.facet).toBe('shape');
    }
  });
});

describe('collectRoutingKinds', () => {
  it('returns every default kind marked as "default" when no live registry is supplied', () => {
    const entries = collectRoutingKinds();
    expect(entries.length).toBe(defaultNodeKinds.length);
    for (const entry of entries) {
      expect(entry.kind).toBe('routingKind');
      expect(entry.facet).toBe('routing');
      expect(entry.source).toBe('default');
      // Built-in shape kinds in defaults cross-link to a ShapeKindEntry.
      expect(entry.shapeKindId).toBe(entry.id);
    }
  });

  it('marks consumer-only kinds with source "consumer" at the end', () => {
    const custom: NodeKind = { name: 'sticky', matches: (d) => (d as { kind?: string })?.kind === 'sticky' };
    const entries = collectRoutingKinds([...defaultNodeKinds, custom]);
    const sticky = entries.find((e) => e.id === 'sticky');
    expect(sticky?.source).toBe('consumer');
    expect(sticky?.shapeKindId).toBeUndefined();
    // Consumer entries trail the defaults.
    expect(entries[entries.length - 1]?.id).toBe('sticky');
  });

  it('marks a default kind with a replaced matches as source "override"', () => {
    const rectIndex = defaultNodeKinds.findIndex((k) => k.name === 'rect');
    expect(rectIndex).toBeGreaterThan(-1);
    const overridden: NodeKind = {
      name: 'rect',
      matches: () => false, // different matches reference
    };
    const live = defaultNodeKinds.map((k, i) => (i === rectIndex ? overridden : k));
    const entries = collectRoutingKinds(live);
    const rectEntry = entries.find((e) => e.id === 'rect');
    expect(rectEntry?.source).toBe('override');
  });
});
