import { describe, it, expect } from 'vitest';
import {
  collectIcons,
  collectBundles,
  collectHotkeyTriggers,
  collectRoutingTrait,
  collectOpFactories,
  collectShapeTrait,
} from './registryData';
import { defaultNodeRouting, type NodeRoutingEntry } from '@orochi235/weasel';

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

describe('collectHotkeyTriggers', () => {
  it('derives entries from tool.offhand binding entries only', () => {
    const actions = [
      { id: 'tool.activate', defaultBinding: [
        { spec: { kind: 'key', key: 'r' }, opts: { params: { toolId: 'rect' } } },
      ] },
      { id: 'tool.offhand', defaultBinding: [
        { spec: { kind: 'key-held', key: ' ' }, opts: { params: { toolId: 'hand' } } },
      ] },
      { id: 'something.else', defaultBinding: { kind: 'key-held', key: 'a' } },
    ];
    const entries = collectHotkeyTriggers(actions);
    expect(entries).toEqual([
      { kind: 'hotkeyTrigger', id: 'hand', label: 'hand (Space)' },
    ]);
  });

  it('skips tool.offhand entries whose spec is not key-held', () => {
    const actions = [
      { id: 'tool.offhand', defaultBinding: [
        { spec: { kind: 'key', key: 'h' }, opts: { params: { toolId: 'hand' } } },
      ] },
    ];
    expect(collectHotkeyTriggers(actions)).toHaveLength(0);
  });

  it('returns empty array when no actions are provided', () => {
    expect(collectHotkeyTriggers([])).toHaveLength(0);
  });

  it('maps Space key to display label "Space"', () => {
    const actions = [
      { id: 'tool.offhand', defaultBinding: [
        { spec: { kind: 'key-held', key: ' ' }, opts: { params: { toolId: 'hand' } } },
      ] },
    ];
    const [entry] = collectHotkeyTriggers(actions);
    expect(entry?.label).toBe('hand (Space)');
  });
});
