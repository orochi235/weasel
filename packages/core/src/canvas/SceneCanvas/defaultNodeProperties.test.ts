import { describe, it, expect } from 'vitest';
import { prefIsEnabled, prefIsShown, prefNumberAt, type PrefBoolean, type PrefEnum, type PrefLeaf, type PrefNumber, type PrefSection, type PrefObject } from '@weasel-js/prefs';
import { defaultNodeProperties, inferredNodeProperties } from './defaultNodeProperties';
import { KIT_SHAPE_KINDS } from 'core/shapeKinds';
import { getMarker, registerMarker } from '@weasel-js/stroke';
import { inferredNodeRouting } from './defaultNodeRouting';
import { qty } from '@weasel-js/quantity';

describe('defaultNodeProperties', () => {
  it('shows every typed number to two places, where a drag or a scale leaves many', () => {
    const typed: [string, PrefNumber][] = [];
    const walk = (at: unknown, key: string): void => {
      if (!at || typeof at !== 'object') return;
      const o = at as Record<string, unknown>;
      if (o.kind === 'number' && o.control !== 'slider' && o.unit === undefined) typed.push([key, o as never]);
      for (const [k, v] of Object.entries(o)) walk(v, k);
    };
    for (const e of defaultNodeProperties) walk(e.schema, e.name);
    expect(typed.map(([key]) => key)).toEqual(expect.arrayContaining(['pose.x', 'pose.width']));
    for (const [key, leaf] of typed) {
      if (!leaf.display) throw new Error(`${key} has no display`);
      expect(qty(123.45678901234567, leaf.display).text).toBe('123.46');
      expect(qty(40, leaf.display).text).toBe('40');
    }
  });

  it('stays in lockstep with KIT_SHAPE_KINDS', () => {
    expect(defaultNodeProperties.map((e) => e.name)).toEqual([...KIT_SHAPE_KINDS]);
  });

  it('every entry has Layout pose leaves and Appearance data leaves', () => {
    for (const e of defaultNodeProperties) {
      const layout = e.schema.members.layout;
      const appearance = e.schema.members.appearance;
      expect(layout && 'members' in layout).toBe(true);
      expect(appearance && 'members' in appearance).toBe(true);
      if (layout && 'members' in layout) {
        expect(Object.keys(layout.members)).toEqual(
          expect.arrayContaining(['pose.x', 'pose.y', 'pose.width', 'pose.height', 'pose.rotation']),
        );
      }
      if (appearance && 'members' in appearance) {
        expect(Object.keys(appearance.members)).toEqual(
          expect.arrayContaining(['data.fill', 'data.stroke']),
        );
      }
    }
  });

});

describe('the W and H leaves', () => {
  const layout = defaultNodeProperties[0]!.schema.members.layout as PrefSection;
  const leaf = (path: string) => layout.members[path] as PrefNumber;
  const reading = (data: unknown) => (path: string): unknown =>
    path.split('.').slice(1).reduce<unknown>((at, k) => (at as Record<string, unknown> | undefined)?.[k], data);

  it('hold a node to its own data.minSize, as minSizeOf reads it', () => {
    const data = { minSize: { width: 40, height: 25 } };
    expect(prefNumberAt(leaf('pose.width'), reading(data)).min).toBe(40);
    expect(prefNumberAt(leaf('pose.height'), reading(data)).min).toBe(25);
  });

  it('hold a node with no minimum, or a side that is not a positive number, to zero', () => {
    expect(prefNumberAt(leaf('pose.width'), reading({})).min).toBe(0);
    expect(prefNumberAt(leaf('pose.height'), reading({ minSize: { width: 40, height: -3 } })).min).toBe(0);
  });
});

describe('pose.transform', () => {
  const leaf = (name: string): PrefBoolean =>
    (defaultNodeProperties.find((e) => e.name === name)!.schema.members.layout as PrefSection).members['pose.transform'] as PrefBoolean;

  it('reads a skewed pose as on and an absent or identity transform as off', () => {
    for (const e of [...defaultNodeProperties, ...inferredNodeProperties]) {
      const { encoding } = (e.schema.members.layout as PrefSection).members['pose.transform'] as PrefBoolean;
      expect(encoding!.read([1, 0, 0.5, 1], undefined)).toBe(true);
      expect(encoding!.read([1, 0, 0, 1], undefined)).toBe(false);
      expect(encoding!.read(undefined, undefined)).toBe(false);
    }
  });

  it('clears the transform when turned off, and keeps the one held when on', () => {
    const { encoding } = leaf('rect');
    const pose = { x: 0, y: 0, width: 10, height: 10, transform: [1, 0, 0.5, 1] };
    expect(encoding!.write(false, pose)).toBeUndefined();
    expect(encoding!.write(true, pose)).toBe(pose.transform);
  });
});

describe('leaves that read an absent value as their default', () => {
  const members = (name: string, section: string): PrefSection['members'] =>
    (defaultNodeProperties.find((e) => e.name === name)!.schema.members[section] as PrefSection).members;
  const flagged = (leaves: Record<string, unknown>): string[] =>
    Object.entries(leaves).filter(([, l]) => (l as PrefLeaf).absentIsDefault === true).map(([k]) => k).sort();

  it('flags the stroke fields the tessellator defaults, at its defaults, and not the stroke itself', () => {
    const appearance = members('rect', 'appearance');
    const stroke = appearance['data.stroke'] as PrefObject;
    expect(flagged(appearance)).toEqual([]);
    expect(flagged(stroke.children)).toEqual(['align', 'cap', 'join', 'trim.end', 'trim.pace', 'trim.start', 'width']);
    expect(Object.fromEntries(flagged(stroke.children).map((k) => [k, (stroke.children[k] as PrefLeaf).default])))
      .toEqual({ align: 'center', cap: 'butt', join: 'miter', 'trim.end': 1, 'trim.pace': 'length', 'trim.start': 0, width: 1 });
  });

});

describe('the stroke leaf\'s dash style', () => {
  const dashLeaf = (): PrefEnum => {
    const entry = inferredNodeProperties.find((e) => e.name === 'path')!;
    const appearance = entry.schema.members.appearance as PrefSection;
    const stroke = appearance.members['data.stroke'] as PrefObject;
    return stroke.children.dash as PrefEnum;
  };

  it('writes a preset as multiples of the stroke width', () => {
    const { write } = dashLeaf().encoding!;
    expect(write('dashed', { width: 4 })).toEqual([12, 8]);
    expect(write('dotted', { width: 2 })).toEqual([2, 4]);
    expect(write('solid', { width: 4, dash: [12, 8] })).toBeUndefined();
  });

  it('reads the stored array against that same width', () => {
    const { read } = dashLeaf().encoding!;
    expect(read(undefined, { width: 4 })).toBe('solid');
    expect(read([12, 8], { width: 4 })).toBe('dashed');
    expect(read([12, 8], { width: 1 })).toBe('custom');
  });

  it('reports nothing at all for a node holding no stroke', () => {
    expect(dashLeaf().encoding!.read(undefined, undefined)).toBeUndefined();
  });

  it('leaves an imported array alone when custom is chosen', () => {
    expect(dashLeaf().encoding!.write('custom', { width: 4, dash: [9, 1, 2, 1] })).toEqual([9, 1, 2, 1]);
  });
});

describe('the stroke leaf\'s nib', () => {
  const strokeLeaf = (): PrefObject => {
    const entry = inferredNodeProperties.find((e) => e.name === 'path')!;
    const appearance = entry.schema.members.appearance as PrefSection;
    return appearance.members['data.stroke'] as PrefObject;
  };

  it('turns a nib on with a default, and off by removing it', () => {
    const nib = strokeLeaf().children.nib as PrefBoolean;
    expect(nib.kind).toBe('boolean');
    expect(nib.encoding!.read(undefined, {})).toBe(false);
    const on = nib.encoding!.write(true, {}) as { angle: number; ratio: number };
    expect(on.ratio).toBeGreaterThan(0);
    expect(on.ratio).toBeLessThan(1);
    expect(nib.encoding!.read(on, { nib: on })).toBe(true);
    const kept = { angle: 1, ratio: 0.5 };
    expect(nib.encoding!.write(true, { nib: kept })).toBe(kept);
    expect(nib.encoding!.write(false, { nib: kept })).toBeUndefined();
  });

  it('edits the angle in degrees and the ratio, shown only while a nib is on', () => {
    const angle = strokeLeaf().children['nib.angle'] as PrefNumber;
    const ratio = strokeLeaf().children['nib.ratio'] as PrefNumber;
    expect(angle.unit).toBeDefined();
    expect([ratio.min, ratio.max]).toEqual([0, 1]);
    expect(angle.showIf).toEqual({ path: 'data.stroke.nib' });
    expect(ratio.showIf).toEqual({ path: 'data.stroke.nib' });
  });
});

describe('the stroke leaf\'s trim', () => {
  const strokeLeaf = (): PrefObject => {
    const entry = inferredNodeProperties.find((e) => e.name === 'path')!;
    const appearance = entry.schema.members.appearance as PrefSection;
    return appearance.members['data.stroke'] as PrefObject;
  };
  const enabledWith = (edge: 'start' | 'end', held: unknown) =>
    prefIsEnabled(strokeLeaf().children[`trim.${edge}`] as PrefNumber, (path) =>
      path === `data.stroke.trim.${edge}` ? held : undefined);

  it('edits each edge as a fraction, absent reading as the whole path', () => {
    const start = strokeLeaf().children['trim.start'] as PrefNumber;
    const end = strokeLeaf().children['trim.end'] as PrefNumber;
    expect([start.min, start.max, start.default]).toEqual([0, 1, 0]);
    expect([end.min, end.max, end.default]).toEqual([0, 1, 1]);
    expect(start.absentIsDefault && end.absentIsDefault).toBe(true);
    expect(start.pair).toEqual({ with: 'data.stroke.trim.end', label: 'Trim' });
  });

  it('disables an edge held as a length, anchor or subpath instead of rewriting it', () => {
    expect(enabledWith('start', undefined)).toBe(true);
    expect(enabledWith('start', 0.25)).toBe(true);
    expect(enabledWith('end', { anchor: 2 })).toBe(false);
    expect(enabledWith('end', { length: 40 })).toBe(false);
  });

  it('shows the pace only while a trim is held', () => {
    const pace = strokeLeaf().children['trim.pace'] as PrefEnum;
    expect(pace.options.map((o) => o.value)).toEqual(['length', 'anchor']);
    const shown = (held: Record<string, unknown>) => prefIsShown(pace, (path) => held[path]);
    expect(shown({})).toBe(false);
    expect(shown({ 'data.stroke.trim.end': 0.5 })).toBe(true);
    expect(shown({ 'data.stroke.trim.start': 0 })).toBe(true);
  });
});

describe('the stroke leaf\'s markers', () => {
  const strokeLeaf = (): PrefObject => {
    const entry = inferredNodeProperties.find((e) => e.name === 'path')!;
    const appearance = entry.schema.members.appearance as PrefSection;
    return appearance.members['data.stroke'] as PrefObject;
  };

  it('offers markerStart, markerMid and markerEnd, with the registry as options', () => {
    for (const key of ['markerStart', 'markerMid', 'markerEnd']) {
      const leaf = strokeLeaf().children[key] as PrefEnum;
      expect(leaf.kind).toBe('enum');
      expect(leaf.options.map((o) => o.value)).toEqual(
        expect.arrayContaining(['', 'arrow', 'circle', 'diamond']),
      );
    }
  });

  it('draws every built-in marker and None as a glyph, and a registered one as text', () => {
    const dispose = registerMarker({ ...getMarker('arrow')!, id: 'test-glyphless-marker' });
    try {
      const options = (strokeLeaf().children.markerEnd as PrefEnum).options;
      for (const o of options) {
        if (o.value === 'test-glyphless-marker') expect(o.icon).toBeUndefined();
        else expect(o.icon, o.value || 'None').toBe(o.value === '' ? 'core:markerNone' : `core:marker${o.value.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase())}`);
      }
    } finally {
      dispose();
    }
  });

  it('lists a marker registered after the schemas were built', () => {
    const dispose = registerMarker({ ...getMarker('arrow')!, id: 'test-late-marker' });
    try {
      for (const key of ['markerStart', 'markerMid', 'markerEnd']) {
        const leaf = strokeLeaf().children[key] as PrefEnum;
        expect(leaf.options.map((o) => o.value)).toContain('test-late-marker');
        expect(leaf.options).toBe(leaf.options);
      }
    } finally {
      dispose();
    }
    expect((strokeLeaf().children.markerEnd as PrefEnum).options.map((o) => o.value))
      .not.toContain('test-late-marker');
  });

  it('reads a bare key or a sized MarkerRef the same way', () => {
    const { read } = (strokeLeaf().children.markerStart as PrefEnum).encoding!;
    expect(read('arrow', undefined)).toBe('arrow');
    expect(read({ key: 'arrow', size: 4 }, undefined)).toBe('arrow');
    expect(read(undefined, undefined)).toBe('');
  });

  it('writes the empty option as no marker at all', () => {
    const { write } = (strokeLeaf().children.markerEnd as PrefEnum).encoding!;
    expect(write('', undefined)).toBeUndefined();
    expect(write('circle', undefined)).toBe('circle');
  });
});

describe('inferredNodeProperties', () => {
  it('stays in lockstep with inferredNodeRouting kind names', () => {
    expect(inferredNodeProperties.map((e) => e.name)).toEqual(
      inferredNodeRouting.map((e) => e.name),
    );
  });
});
