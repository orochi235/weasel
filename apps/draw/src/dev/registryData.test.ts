import { describe, it, expect } from 'vitest';
import type { IconRef } from '@weasel-js/icons';
import { collectIcons, collectBundles, collectPropertiesTrait, collectOpFactories, collectOpKinds, collectShapeTrait } from './registryData';
import type { ActionEntry } from './registryEntries';
import { icon } from '../icons.gen';
import * as Weasel from '@weasel-js/core';
import { defaultNodeProperties, type NodePropertiesEntry } from '@weasel-js/core';

describe('registryData static collectors', () => {
  it('collectIcons lists every draw glyph alongside the actions\' glyphs', () => {
    const icons = collectIcons([]);
    const byId = new Map(icons.map((i) => [i.id, i]));
    expect(byId.get('draw:settings')?.source).toBe('app');
    for (const i of icons) {
      expect(i.kind).toBe('icon');
      expect(i.ref).toBe(i.id);
    }
  });

  it('collectIcons reads action glyphs off the actions, once each, under their names', () => {
    const entry = (id: string, items: { key: string; icon?: IconRef }[]): ActionEntry => ({
      kind: 'action', id, label: id, items: items.map((i) => ({ ...i, label: i.key })),
    });
    const icons = collectIcons([
      entry('undo', [{ key: 'undo', icon: icon('core:undo') }]),
      entry('flip', [
        { key: 'flip:x', icon: icon('core:flipX') },
        { key: 'flip:y', icon: icon('core:flipY') },
      ]),
      entry('app.thing', [{ key: 'app.thing', icon: icon('core:flipY') }]),
      entry('app.bare', [{ key: 'app.bare' }]),
    ]).filter((i) => i.source === 'action');
    expect(icons.map((i) => i.id)).toEqual(['core:undo', 'core:flipX', 'core:flipY']);
    expect(icons[2]?.actions).toEqual(['flip:y', 'app.thing']);
  });

  it('collectBundles lists every core preset, each with the tools its includes mount', () => {
    const bundles = collectBundles();
    expect(bundles.map((b) => b.id)).toEqual([...Weasel.SCENE_CANVAS_FEATURES]);
    const draw = bundles.find((b) => b.id === 'draw')!;
    expect([...draw.tools].sort()).toEqual(['hand', 'lasso', 'select']);
    expect(draw.atom).toBe(false);
    expect(bundles.find((b) => b.id === 'resize')!.atom).toBe(true);
    expect(bundles.find((b) => b.id === 'tools:shape')!.tools).toContain('rect');
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

  it('flattens the rect kind\'s groups and object leaves into its exact 19 dotted leaf paths', () => {
    const entries = collectPropertiesTrait();
    const rect = entries.find((e) => e.id === 'rect');
    expect(rect).toBeDefined();
    // `data.stroke` is one object leaf, so what it exposes is its fields —
    // the leaf itself is the container, and the pane lists what is editable.
    expect(rect!.leafPaths).toEqual([
      'pose.x', 'pose.y', 'pose.width', 'pose.height', 'pose.rotation', 'pose.transform',
      'data.fill.paint',
      'data.stroke.width', 'data.stroke.paint', 'data.stroke.cap',
      'data.stroke.join', 'data.stroke.align', 'data.stroke.dash',
      'data.stroke.nib', 'data.stroke.nib.angle', 'data.stroke.nib.ratio',
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
      name: 'stamp',
      schema: { name: 'Sticky', members: {} },
    };
    const entries = collectPropertiesTrait([custom]);
    expect(entries.length).toBe(1);
    expect(entries[0].id).toBe('stamp');
    expect(entries[0].leafPaths).toEqual([]);
  });
});
