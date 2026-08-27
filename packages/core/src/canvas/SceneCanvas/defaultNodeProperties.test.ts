import { describe, it, expect } from 'vitest';
import { defaultNodeProperties, inferredNodeProperties } from './defaultNodeProperties';
import { KIT_SHAPE_KINDS } from './shapeKinds';
import { inferredNodeRouting } from './defaultNodeRouting';
import type { ToolPrefGroup, ToolPrefObject } from 'tools/prefs';

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
      // No `fill`: a text node's color is its own `data.fill`, in Appearance,
      // the same leaf every other node kind paints from.
    ]);
    const paragraph = style.children.paragraph as ToolPrefGroup;
    expect(Object.keys(paragraph.children)).toEqual(['align', 'lineHeight']);
  });
});
