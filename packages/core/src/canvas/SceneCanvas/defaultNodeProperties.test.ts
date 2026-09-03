import { describe, it, expect } from 'vitest';
import { defaultNodeProperties, inferredNodeProperties } from './defaultNodeProperties';
import { KIT_SHAPE_KINDS } from 'core/shapeKinds';
import { inferredNodeRouting } from './defaultNodeRouting';
import type { ToolPrefBoolean, ToolPrefEnum, ToolPrefGroup, ToolPrefObject } from 'tools/prefs';

describe('defaultNodeProperties', () => {
  it('stays in lockstep with KIT_SHAPE_KINDS', () => {
    expect(defaultNodeProperties.map((e) => e.name)).toEqual([...KIT_SHAPE_KINDS]);
  });

  it('every entry has Layout pose leaves and Appearance data leaves', () => {
    for (const e of defaultNodeProperties) {
      const layout = e.schema.children.layout;
      const appearance = e.schema.children.appearance;
      expect(layout && 'children' in layout).toBe(true);
      expect(appearance && 'children' in appearance).toBe(true);
      if (layout && 'children' in layout) {
        expect(Object.keys(layout.children)).toEqual(
          expect.arrayContaining(['pose.x', 'pose.y', 'pose.width', 'pose.height', 'pose.rotation']),
        );
      }
      if (appearance && 'children' in appearance) {
        expect(Object.keys(appearance.children)).toEqual(
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
    const content = text?.schema.children.content;
    expect(content && 'children' in content && 'data.text' in content.children).toBe(true);
    const typography = text?.schema.children.text;
    expect(typography && 'children' in typography && 'data.style' in typography.children).toBe(true);
  });
});

describe('the stroke leaf\'s dash style', () => {
  const dashLeaf = (): ToolPrefEnum => {
    const entry = inferredNodeProperties.find((e) => e.name === 'path')!;
    const appearance = entry.schema.children.appearance as ToolPrefGroup;
    const stroke = appearance.children['data.stroke'] as ToolPrefObject;
    return stroke.children.dash as ToolPrefEnum;
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
  const strokeLeaf = (): ToolPrefObject => {
    const entry = inferredNodeProperties.find((e) => e.name === 'path')!;
    const appearance = entry.schema.children.appearance as ToolPrefGroup;
    return appearance.children['data.stroke'] as ToolPrefObject;
  };

  it('offers markerStart, markerMid and markerEnd, with the registry as options', () => {
    for (const key of ['markerStart', 'markerMid', 'markerEnd']) {
      const leaf = strokeLeaf().children[key] as ToolPrefEnum;
      expect(leaf.kind).toBe('enum');
      expect(leaf.options.map((o) => o.value)).toEqual(
        expect.arrayContaining(['', 'arrow', 'circle', 'diamond']),
      );
    }
  });

  it('reads a bare key or a sized MarkerRef the same way', () => {
    const { read } = (strokeLeaf().children.markerStart as ToolPrefEnum).encoding!;
    expect(read('arrow', undefined)).toBe('arrow');
    expect(read({ key: 'arrow', size: 4 }, undefined)).toBe('arrow');
    expect(read(undefined, undefined)).toBe('');
  });

  it('writes the empty option as no marker at all', () => {
    const { write } = (strokeLeaf().children.markerEnd as ToolPrefEnum).encoding!;
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
    const text = entry.schema.children.text as ToolPrefGroup;
    const style = text.children['data.style'] as ToolPrefObject;
    expect(style.kind).toBe('object');
    expect(Object.keys(style.children)).toEqual(['character', 'paragraph']);
  });

  it('addresses typography as fields of the style, not as sibling paths', () => {
    // The groups head the two lists and contribute nothing to the path, so a
    // field inside one is a field of `data.style` — which is what lets one
    // control commit the whole `TextStyle` instead of half-writing it.
    const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
    const style = ((entry.schema.children.text as ToolPrefGroup).children['data.style']) as ToolPrefObject;
    const character = style.children.character as ToolPrefGroup;
    // Family first, then the paired size and weight — `pair` merges adjacent
    // leaves, so the two it merges have to be adjacent.
    expect(Object.keys(character.children)).toEqual([
      'fontFamily',
      'fontSize',
      'fontWeight',
      'fontStyle',
      'letterSpacing',
      'underline',
      'strikethrough',
      'overline',
      // No `fill`: a text node's color is its own `data.fill`, in Appearance,
      // the same leaf every other node kind paints from.
    ]);
    const paragraph = style.children.paragraph as ToolPrefGroup;
    expect(Object.keys(paragraph.children)).toEqual(['align', 'lineHeight']);
  });

  it('asks for the three decorations as one row of toggles', () => {
    const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
    const style = ((entry.schema.children.text as ToolPrefGroup).children['data.style']) as ToolPrefObject;
    const character = style.children.character as ToolPrefGroup;
    const decorations = ['underline', 'strikethrough', 'overline'].map(
      (k) => character.children[k] as ToolPrefBoolean,
    );
    expect(decorations.map((d) => d.control)).toEqual(['toggle', 'toggle', 'toggle']);
    expect(decorations.map((d) => d.short)).toEqual(['U', 'S', 'O']);
    expect(decorations.map((d) => d.pair)).toEqual(['Decoration', 'Decoration', 'Decoration']);
  });
});
