import { describe, it, expect } from 'vitest';
import {
  collectIcons,
  collectBundles,
  collectRoutingTrait,
  collectPropertiesTrait,
  collectOpFactories,
  collectShapeTrait,
} from './registryData';
import { defaultNodeRouting, defaultNodeProperties, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';

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

  it('collectShapeTrait returns the built-in shape kind ids', () => {
    const kinds = collectShapeTrait();
    const ids = kinds.map((k) => k.id);
    expect(ids).toContain('rect');
    expect(ids).toContain('ellipse');
    expect(ids).toContain('polygon');
    for (const k of kinds) {
      expect(k.kind).toBe('shapeKind');
    }
  });
});

describe('collectShapeTrait — trait tag', () => {
  it('tags every entry with trait: shape', () => {
    const entries = collectShapeTrait();
    for (const entry of entries) {
      expect(entry.trait).toBe('shape');
    }
  });
});

describe('collectRoutingTrait', () => {
  it('returns every default kind marked as "default" when no live registry is supplied', () => {
    const entries = collectRoutingTrait();
    expect(entries.length).toBe(defaultNodeRouting.length);
    for (const entry of entries) {
      expect(entry.kind).toBe('routingKind');
      expect(entry.trait).toBe('routing');
      expect(entry.source).toBe('default');
      // Built-in shape kinds in defaults cross-link to a ShapeKindEntry.
      expect(entry.shapeKindId).toBe(entry.id);
    }
  });

  it('marks consumer-only kinds with source "consumer" at the end', () => {
    const custom: NodeRoutingEntry = { name: 'sticky', matches: (d) => (d as { kind?: string })?.kind === 'sticky' };
    const entries = collectRoutingTrait([...defaultNodeRouting, custom]);
    const sticky = entries.find((e) => e.id === 'sticky');
    expect(sticky?.source).toBe('consumer');
    expect(sticky?.shapeKindId).toBeUndefined();
    // Consumer entries trail the defaults.
    expect(entries[entries.length - 1]?.id).toBe('sticky');
  });

  it('marks a default kind with a replaced matches as source "override"', () => {
    const rectIndex = defaultNodeRouting.findIndex((k) => k.name === 'rect');
    expect(rectIndex).toBeGreaterThan(-1);
    const overridden: NodeRoutingEntry = {
      name: 'rect',
      matches: () => false, // different matches reference
    };
    const live = defaultNodeRouting.map((k, i) => (i === rectIndex ? overridden : k));
    const entries = collectRoutingTrait(live);
    const rectEntry = entries.find((e) => e.id === 'rect');
    expect(rectEntry?.source).toBe('override');
  });
});

describe('collectPropertiesTrait', () => {
  it('returns every default kind, tagged with trait: properties, when no live registry is supplied', () => {
    const entries = collectPropertiesTrait();
    expect(entries.length).toBe(defaultNodeProperties.length);
    for (const entry of entries) {
      expect(entry.kind).toBe('propertiesKind');
      expect(entry.trait).toBe('properties');
      expect(Array.isArray(entry.leafPaths)).toBe(true);
    }
  });

  it('flattens the rect kind\'s nested schema groups into its exact 8 dotted leaf paths', () => {
    const entries = collectPropertiesTrait();
    const rect = entries.find((e) => e.id === 'rect');
    expect(rect).toBeDefined();
    expect(rect!.leafPaths).toEqual([
      'pose.x', 'pose.y', 'pose.width', 'pose.height', 'pose.rotation',
      'data.fill', 'data.stroke', 'data.strokeWidth',
    ]);
  });

  it('adds data.text as a ninth leaf for the text kind', () => {
    const entries = collectPropertiesTrait();
    const text = entries.find((e) => e.id === 'text');
    expect(text).toBeDefined();
    expect(text!.leafPaths).toContain('data.text');
    expect(text!.leafPaths.length).toBe(9);
  });

  it('uses a supplied live registry instead of the defaults', () => {
    const custom: NodePropertiesEntry = {
      name: 'sticky',
      schema: { name: 'Sticky', children: {} },
    };
    const entries = collectPropertiesTrait([custom]);
    expect(entries.length).toBe(1);
    expect(entries[0].id).toBe('sticky');
    expect(entries[0].leafPaths).toEqual([]);
  });
});
