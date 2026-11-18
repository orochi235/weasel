/** The `text` kind's properties, `TEXT_PROPERTIES`: what a `SelectionPanel` given `textPreset` offers for a text node. */
import { describe, it, expect } from 'vitest';
import { prefSectionLeaves, type PrefBoolean, type PrefEnum, type PrefLeaf, type PrefNumber, type PrefSection, type PrefObject } from '@weasel-js/prefs-schema';
import { qty } from '@weasel-js/quantity';
import { DEFAULT_TEXT_STYLE, type TextStyle } from '@weasel-js/text';
import { TEXT_PROPERTIES } from './properties';

/** Colors the edit overlay reads, which are chrome rather than document. */
type EditOverlayChrome = 'caretColor' | 'selectionBackground' | 'selectionColor';

describe('TEXT_PROPERTIES', () => {
  it('shows every typed number to two places, where a drag or a scale leaves many', () => {
    const typed: [string, PrefNumber][] = [];
    const walk = (at: unknown, key: string): void => {
      if (!at || typeof at !== 'object') return;
      const o = at as Record<string, unknown>;
      if (o.kind === 'number' && o.control !== 'slider' && o.unit === undefined) typed.push([key, o as never]);
      for (const [k, v] of Object.entries(o)) walk(v, k);
    };
    walk(TEXT_PROPERTIES.schema, TEXT_PROPERTIES.name);
    expect(typed.map(([key]) => key)).toEqual(expect.arrayContaining(['pose.x', 'pose.width', 'fontSize']));
    for (const [key, leaf] of typed) {
      if (!leaf.display) throw new Error(`${key} has no display`);
      expect(qty(123.45678901234567, leaf.display).text).toBe('123.46');
      expect(qty(40, leaf.display).text).toBe('40');
    }
  });

  it('has Layout pose leaves and Appearance data leaves, as every kind does', () => {
    const layout = TEXT_PROPERTIES.schema.members.layout as PrefSection;
    const appearance = TEXT_PROPERTIES.schema.members.appearance as PrefSection;
    expect(Object.keys(layout.members)).toEqual(
      expect.arrayContaining(['pose.x', 'pose.y', 'pose.width', 'pose.height', 'pose.rotation']),
    );
    expect(Object.keys(appearance.members)).toEqual(expect.arrayContaining(['data.fill', 'data.stroke']));
  });

  it('separates a text node\'s content from its typography', () => {
    // Two sections, not one: the content is what the node is, the style is how
    // it is drawn, and a single group named after the content field nested the
    // word inside itself.
    const text = TEXT_PROPERTIES;
    const content = text.schema.members.content;
    expect(content && 'members' in content && 'data.text' in content.members).toBe(true);
    const typography = text.schema.members.text;
    expect(typography && 'members' in typography && 'data.style' in typography.members).toBe(true);
  });
});

describe('text leaves that read an absent value as their default', () => {
  const members = (section: string): PrefSection['members'] =>
    (TEXT_PROPERTIES.schema.members[section] as PrefSection).members;
  const flagged = (leaves: Record<string, unknown>): string[] =>
    Object.entries(leaves).filter(([, l]) => (l as PrefLeaf).absentIsDefault === true).map(([k]) => k).sort();

  it('flags the text style fields `resolveTextStyle` defaults, each at `DEFAULT_TEXT_STYLE`\'s value', () => {
    const style = members('text')['data.style'] as PrefObject;
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
    expect(flagged(members('content'))).toEqual(['data.text']);
    expect(flagged(members('text'))).toEqual(['data.padding', 'data.style', 'data.verticalAlign']);
    expect(flagged(members('layout'))).toEqual(['pose.rotation']);
  });
});

describe('the text style leaf', () => {
  it('gives text nodes Character and Paragraph groups inside the style leaf', () => {
    const entry = TEXT_PROPERTIES;
    const text = entry.schema.members.text as PrefSection;
    const style = text.members['data.style'] as PrefObject;
    expect(style.kind).toBe('object');
    expect(Object.keys(style.children)).toEqual(['character', 'paragraph']);
  });

  it('addresses typography as fields of the style, not as sibling paths', () => {
    // The groups head the two lists and contribute nothing to the path, so a
    // field inside one is a field of `data.style` — which is what lets one
    // control commit the whole `TextStyle` instead of half-writing it.
    const entry = TEXT_PROPERTIES;
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
    const entry = TEXT_PROPERTIES;
    const style = ((entry.schema.members.text as PrefSection).members['data.style']) as PrefObject;
    const fields = Object.values(style.children).flatMap((g) => Object.keys((g as PrefSection).members));
    expect(fields.sort()).toEqual(Object.keys(offered).sort());
  });

  it('offers justify, start and end as Align segments of their own, each lit by its own value', () => {
    const entry = TEXT_PROPERTIES;
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
    const entry = TEXT_PROPERTIES;
    const text = entry.schema.members.text as PrefSection;
    expect(Object.keys(text.members)).toEqual(['data.style', 'data.padding', 'data.verticalAlign', 'data.overflow', 'data.fit']);
    const vertical = text.members['data.verticalAlign'] as PrefEnum;
    expect(vertical.options.map((o) => o.value)).toEqual(['top', 'center', 'bottom']);
  });

  it('offers clipping the text to its box as a switch over `data.overflow`', () => {
    const entry = TEXT_PROPERTIES;
    const clip = (entry.schema.members.text as PrefSection).members['data.overflow'] as PrefBoolean;
    expect(clip.control).toBe('switch');
    const { read, write } = clip.encoding!;
    expect(read('clip', undefined)).toBe(true);
    expect(read('visible', undefined)).toBe(false);
    expect(read(undefined, undefined)).toBe(false);
    expect(write(true, undefined)).toBe('clip');
    expect(write(false, undefined)).toBeUndefined();
  });

  it('offers shrinking the text to its box as a switch over `data.fit`', () => {
    const entry = TEXT_PROPERTIES;
    const fit = (entry.schema.members.text as PrefSection).members['data.fit'] as PrefBoolean;
    expect(fit.control).toBe('switch');
    const { read, write } = fit.encoding!;
    expect(read('shrink', undefined)).toBe(true);
    expect(read('none', undefined)).toBe(false);
    expect(read(undefined, undefined)).toBe(false);
    expect(write(true, undefined)).toBe('shrink');
    expect(write(false, undefined)).toBeUndefined();
  });

  it('asks for italic, the decorations and the scripts as one row of glyph toggles', () => {
    const entry = TEXT_PROPERTIES;
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
    const entry = TEXT_PROPERTIES;
    const style = ((entry.schema.members.text as PrefSection).members['data.style']) as PrefObject;
    const italic = (style.children.character as PrefSection).members.fontStyle as PrefBoolean;
    expect(italic.encoding!.read('italic', undefined)).toBe(true);
    expect(italic.encoding!.read('normal', undefined)).toBe(false);
    expect(italic.encoding!.read(undefined, undefined)).toBe(false);
    expect(italic.encoding!.write(true, undefined)).toBe('italic');
    expect(italic.encoding!.write(false, undefined)).toBeUndefined();
  });
});
