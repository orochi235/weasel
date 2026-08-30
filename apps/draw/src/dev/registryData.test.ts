import { describe, it, expect } from 'vitest';
import {
  collectIcons,
  collectBundles,
  collectRoutingTrait,
  collectPropertiesTrait,
  collectOpFactories,
  collectOpKinds,
  collectShapeTrait,
} from './registryData';
import * as Weasel from '@weasel-js/core';
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

  it('collectOpKinds lists every op kind registered with the kit', () => {
    const listed = collectOpKinds().map((o) => o.id).sort();
    expect(listed).toEqual([...Weasel.registeredOpNames()].sort());
  });

  it('collectOpFactories names a real factory export for every registered op kind', () => {
    const ids = collectOpFactories().map((f) => f.id).sort();
    const expected = Weasel.registeredOpNames()
      .map((n) => `create${n[0]!.toUpperCase()}${n.slice(1)}Op`)
      .sort();
    expect(ids).toEqual(expected);
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

  it('flattens the rect kind\'s groups and object leaves into its exact 15 dotted leaf paths', () => {
    const entries = collectPropertiesTrait();
    const rect = entries.find((e) => e.id === 'rect');
    expect(rect).toBeDefined();
    // `data.stroke` is one object leaf, so what it exposes is its fields —
    // the leaf itself is the container, and the pane lists what is editable.
    expect(rect!.leafPaths).toEqual([
      'pose.x', 'pose.y', 'pose.width', 'pose.height', 'pose.rotation',
      'data.fill',
      'data.stroke.width', 'data.stroke.paint', 'data.stroke.cap',
      'data.stroke.join', 'data.stroke.align', 'data.stroke.dash',
      'data.stroke.markerStart', 'data.stroke.markerMid', 'data.stroke.markerEnd',
    ]);
  });

  it('gives the text kind every base shape leaf plus the text-only ones', () => {
    const entries = collectPropertiesTrait();
    const rect = entries.find((e) => e.id === 'rect')!;
    const text = entries.find((e) => e.id === 'text')!;
    expect(text).toBeDefined();
    // The text schema is the shape schema with its text groups interleaved, so
    // every base leaf must survive in relative order — a count would only tell
    // us the total changed, not whether `text` still carries pose and
    // appearance. Not a prefix: `Content` sits between Layout and Appearance.
    expect(text.leafPaths.filter((p) => rect.leafPaths.includes(p))).toEqual(rect.leafPaths);
    expect(text.leafPaths.length).toBeGreaterThan(rect.leafPaths.length);
    // The text-only leaves, one per nesting level of the Text group, so a
    // group that stops being flattened is caught.
    expect(text.leafPaths).toContain('data.text');
    expect(text.leafPaths).toContain('data.style.fontSize');
    expect(text.leafPaths).toContain('data.style.align');
  });

  it('flattens nested groups to distinct leaf paths', () => {
    // `collectPropertiesTrait` flattens on the child *key*, discarding which
    // group a leaf came from, so the same key under two groups collapses to
    // two identical paths — one control editing another's field. Nothing in
    // the schema type prevents it, so assert it here. This is what the old
    // exact-count assertion on the text kind was standing in for.
    for (const entry of collectPropertiesTrait()) {
      expect(new Set(entry.leafPaths).size).toBe(entry.leafPaths.length);
    }
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
