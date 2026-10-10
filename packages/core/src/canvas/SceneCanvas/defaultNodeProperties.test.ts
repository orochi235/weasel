import { describe, it, expect } from 'vitest';
import type { PrefBoolean, PrefEnum, PrefSection, PrefObject } from '@weasel-js/prefs';
import { defaultNodeProperties, inferredNodeProperties } from './defaultNodeProperties';
import { KIT_SHAPE_KINDS } from 'core/shapeKinds';
import { inferredNodeRouting } from './defaultNodeRouting';
import type { TextStyle } from '@weasel-js/text';

/** Colors the edit overlay reads, which are chrome rather than document. */
type EditOverlayChrome = 'caretColor' | 'selectionBackground' | 'selectionColor';

describe('defaultNodeProperties', () => {
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
      // No `fill`: a text node's color is its own `data.fill`, in Appearance,
      // the same leaf every other node kind paints from.
    ]);
    const paragraph = style.children.paragraph as PrefSection;
    expect(Object.keys(paragraph.members)).toEqual(['lineHeight', 'wrap', 'direction', 'align']);
  });

  it('exposes every authored TextStyle field', () => {
    // Keyed by the type, so a field added to `TextStyle` fails to compile here
    // until it is either offered or named as deliberately left out.
    const offered: Record<Exclude<keyof TextStyle, EditOverlayChrome>, true> = {
      fontSize: true, fontFamily: true, fontWeight: true, fontStyle: true, align: true,
      direction: true, lineHeight: true, wrap: true, letterSpacing: true, underline: true,
      strikethrough: true, overline: true, textTransform: true, fontVariantCaps: true, script: true,
    };
    const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
    const style = ((entry.schema.members.text as PrefSection).members['data.style']) as PrefObject;
    const fields = Object.values(style.children).flatMap((g) => Object.keys((g as PrefSection).members));
    expect(fields.sort()).toEqual(Object.keys(offered).sort());
  });

  it('offers justify as a fourth Align segment, lit by justify alone', () => {
    const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
    const style = ((entry.schema.members.text as PrefSection).members['data.style']) as PrefObject;
    const align = (style.children.paragraph as PrefSection).members.align as PrefEnum;
    expect(align.options.map((o) => [o.value, o.icon])).toEqual([
      ['left', 'textAlignLeft'], ['center', 'textAlignCenter'], ['right', 'textAlignRight'],
      ['justify', 'textAlignJustify'],
    ]);
    expect(align.encoding!.read('justify', { direction: 'rtl' })).toBe('justify');
    expect(align.encoding!.read('start', { direction: 'rtl' })).toBe('right');
  });

  it('offers the box alignment beside the style, as a field of the node', () => {
    const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
    const text = entry.schema.members.text as PrefSection;
    expect(Object.keys(text.members)).toEqual(['data.style', 'data.verticalAlign']);
    const vertical = text.members['data.verticalAlign'] as PrefEnum;
    expect(vertical.options.map((o) => o.value)).toEqual(['top', 'center', 'bottom']);
  });

  it('asks for italic, the decorations and the scripts as one row of glyph toggles', () => {
    const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
    const style = ((entry.schema.members.text as PrefSection).members['data.style']) as PrefObject;
    const character = style.children.character as PrefSection;
    const flags = ['fontStyle', 'underline', 'strikethrough', 'overline'].map(
      (k) => character.members[k] as PrefBoolean,
    );
    expect(flags.map((d) => d.control)).toEqual(['toggle', 'toggle', 'toggle', 'toggle']);
    expect(flags.map((d) => d.icon)).toEqual(['italic', 'underline', 'strikethrough', 'overline']);
    const script = character.members.script as PrefEnum;
    expect(script).toMatchObject({ control: 'toggle', clearable: true });
    expect(script.options.map((o) => o.icon)).toEqual(['superscript', 'subscript']);
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
