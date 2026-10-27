import { describe, it, expect } from 'vitest';
import { prefNumberAt, prefSectionLeaves, type PrefBoolean, type PrefEnum, type PrefLeaf, type PrefNumber, type PrefSection, type PrefObject } from '@weasel-js/prefs';
import { defaultNodeProperties, inferredNodeProperties } from './defaultNodeProperties';
import { KIT_SHAPE_KINDS } from 'core/shapeKinds';
import { getMarker, registerMarker } from '@weasel-js/stroke';
import { inferredNodeRouting } from './defaultNodeRouting';
import { DEFAULT_TEXT_STYLE, type TextStyle } from '@weasel-js/text';
import { qty } from '@weasel-js/quantity';

/** Colors the edit overlay reads, which are chrome rather than document. */
type EditOverlayChrome = 'caretColor' | 'selectionBackground' | 'selectionColor';

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
    expect(typed.map(([key]) => key)).toEqual(expect.arrayContaining(['pose.x', 'pose.width', 'fontSize']));
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

  it('separates a text node\'s content from its typography', () => {
    // Two sections, not one: the content is what the node is, the style is how
    // it is drawn, and a single group named after the content field nested the
    // word inside itself.
    const text = defaultNodeProperties.find((e) => e.name === 'text');
    const content = text?.schema.members.content;
    expect(content && 'members' in content && 'data.text' in content.members).toBe(true);
    const typography = text?.schema.members.text;
    expect(typography && 'members' in typography && 'data.style' in typography.members).toBe(true);
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
    expect(flagged(stroke.children)).toEqual(['align', 'cap', 'join', 'width']);
    expect(Object.fromEntries(flagged(stroke.children).map((k) => [k, (stroke.children[k] as PrefLeaf).default])))
      .toEqual({ align: 'center', cap: 'butt', join: 'miter', width: 1 });
  });

  it('flags the text style fields `resolveTextStyle` defaults, each at `DEFAULT_TEXT_STYLE`\'s value', () => {
    const style = members('text', 'text')['data.style'] as PrefObject;
    const fields = Object.fromEntries(prefSectionLeaves(style.children));
    // `fontStyle`, `script` and `lang` read absence themselves.
    expect(flagged(fields)).toEqual([
      'align', 'direction', 'fontFamily', 'fontSize', 'fontVariantCaps', 'fontWeight', 'letterSpacing', 'lineHeight',
      'overline', 'strikethrough', 'tabSize', 'textTransform', 'underline', 'wrap',
    ]);
    for (const key of flagged(fields)) {
      expect([key, fields[key]!.default]).toEqual([key, DEFAULT_TEXT_STYLE[key as keyof typeof DEFAULT_TEXT_STYLE]]);
    }
  });

  it('flags a text node\'s text, style, padding, and vertical alignment, which draw without being held', () => {
    expect(flagged(members('text', 'content'))).toEqual(['data.text']);
    expect(flagged(members('text', 'text'))).toEqual(['data.padding', 'data.style', 'data.verticalAlign']);
    expect(flagged(members('text', 'layout'))).toEqual(['pose.rotation']);
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

  it('gives text nodes Character and Paragraph groups inside the style leaf', () => {
    const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
    const text = entry.schema.members.text as PrefSection;
    const style = text.members['data.style'] as PrefObject;
    expect(style.kind).toBe('object');
    expect(Object.keys(style.children)).toEqual(['character', 'paragraph']);
  });

  it('addresses typography as fields of the style, not as sibling paths', () => {
    // The groups head the two lists and contribute nothing to the path, so a
    // field inside one is a field of `data.style` — which is what lets one
    // control commit the whole `TextStyle` instead of half-writing it.
    const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
    const style = ((entry.schema.members.text as PrefSection).members['data.style']) as PrefObject;
    const character = style.children.character as PrefSection;
    // Family first, then the paired size and weight — `pair` merges adjacent
    // leaves, so the leaves it merges have to be adjacent. The same holds for
    // the style strip after them.
    expect(Object.keys(character.members)).toEqual([
      'fontFamily',
      'fontSize',
      'fontWeight',
      'fontStyle',
      'underline',
      'strikethrough',
      'overline',
      'script',
      'letterSpacing',
      'textTransform',
      'fontVariantCaps',
      'lang',
      // No `fill`: a text node's color is its own `data.fill`, in Appearance,
      // the same leaf every other node kind paints from.
    ]);
    const paragraph = style.children.paragraph as PrefSection;
    expect(Object.keys(paragraph.members)).toEqual(['lineHeight', 'wrap', 'tabSize', 'direction', 'align']);
  });

  it('exposes every authored TextStyle field', () => {
    // Keyed by the type, so a field added to `TextStyle` fails to compile here
    // until it is either offered or named as deliberately left out.
    const offered: Record<Exclude<keyof TextStyle, EditOverlayChrome>, true> = {
      fontSize: true, fontFamily: true, fontWeight: true, fontStyle: true, align: true,
      direction: true, lineHeight: true, tabSize: true, wrap: true, letterSpacing: true, underline: true,
      strikethrough: true, overline: true, textTransform: true, fontVariantCaps: true, script: true,
      lang: true,
    };
    const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
    const style = ((entry.schema.members.text as PrefSection).members['data.style']) as PrefObject;
    const fields = Object.values(style.children).flatMap((g) => Object.keys((g as PrefSection).members));
    expect(fields.sort()).toEqual(Object.keys(offered).sort());
  });

  it('offers justify, start and end as Align segments of their own, each lit by its own value', () => {
    const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
    const style = ((entry.schema.members.text as PrefSection).members['data.style']) as PrefObject;
    const align = (style.children.paragraph as PrefSection).members.align as PrefEnum;
    expect(align.options.map((o) => [o.value, o.icon])).toEqual([
      ['left', 'core:textAlignLeft'], ['center', 'core:textAlignCenter'], ['right', 'core:textAlignRight'],
      ['justify', 'core:textAlignJustify'], ['start', 'core:textAlignStart'], ['end', 'core:textAlignEnd'],
    ]);
    // Read as stored: under a stated direction `start` lights Start, not the edge it resolves to.
    expect(align.encoding).toBeUndefined();
  });

  it('offers the padding and the box alignment beside the style, as fields of the node', () => {
    const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
    const text = entry.schema.members.text as PrefSection;
    expect(Object.keys(text.members)).toEqual(['data.style', 'data.padding', 'data.verticalAlign', 'data.overflow']);
    const vertical = text.members['data.verticalAlign'] as PrefEnum;
    expect(vertical.options.map((o) => o.value)).toEqual(['top', 'center', 'bottom']);
  });

  it('offers clipping the text to its box as a switch over `data.overflow`', () => {
    const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
    const clip = (entry.schema.members.text as PrefSection).members['data.overflow'] as PrefBoolean;
    expect(clip.control).toBe('switch');
    const { read, write } = clip.encoding!;
    expect(read('clip', undefined)).toBe(true);
    expect(read('visible', undefined)).toBe(false);
    expect(read(undefined, undefined)).toBe(false);
    expect(write(true, undefined)).toBe('clip');
    expect(write(false, undefined)).toBeUndefined();
  });

  it('asks for italic, the decorations and the scripts as one row of glyph toggles', () => {
    const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
    const style = ((entry.schema.members.text as PrefSection).members['data.style']) as PrefObject;
    const character = style.children.character as PrefSection;
    const flags = ['fontStyle', 'underline', 'strikethrough', 'overline'].map(
      (k) => character.members[k] as PrefBoolean,
    );
    expect(flags.map((d) => d.control)).toEqual(['toggle', 'toggle', 'toggle', 'toggle']);
    expect(flags.map((d) => d.icon)).toEqual(['core:italic', 'core:underline', 'core:strikethrough', 'core:overline']);
    const script = character.members.script as PrefEnum;
    expect(script).toMatchObject({ control: 'toggle', clearable: true });
    expect(script.options.map((o) => o.icon)).toEqual(['core:superscript', 'core:subscript']);
    expect(flags[0]!.pair).toEqual({
      with: ['data.style.underline', 'data.style.strikethrough', 'data.style.overline', 'data.style.script'],
      label: 'Style',
    });
  });

  it('stores italic as the fontStyle it is, and upright as no field at all', () => {
    const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
    const style = ((entry.schema.members.text as PrefSection).members['data.style']) as PrefObject;
    const italic = (style.children.character as PrefSection).members.fontStyle as PrefBoolean;
    expect(italic.encoding!.read('italic', undefined)).toBe(true);
    expect(italic.encoding!.read('normal', undefined)).toBe(false);
    expect(italic.encoding!.read(undefined, undefined)).toBe(false);
    expect(italic.encoding!.write(true, undefined)).toBe('italic');
    expect(italic.encoding!.write(false, undefined)).toBeUndefined();
  });
});
