import { describe, it, expect } from 'vitest';
import { defaultNodeProperties, inferredNodeProperties } from './defaultNodeProperties';
import { KIT_SHAPE_KINDS } from './useBuiltinShapeTools';
import { inferredNodeRouting } from './defaultNodeRouting';

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
          expect.arrayContaining(['data.fill', 'data.stroke', 'data.strokeWidth']),
        );
      }
    }
  });

  it('text kind carries a data.text leaf', () => {
    const text = defaultNodeProperties.find((e) => e.name === 'text');
    const textGroup = text?.schema.children.text;
    expect(textGroup && 'children' in textGroup && 'data.text' in textGroup.children).toBe(true);
  });
});

describe('inferredNodeProperties', () => {
  it('stays in lockstep with inferredNodeRouting kind names', () => {
    expect(inferredNodeProperties.map((e) => e.name)).toEqual(
      inferredNodeRouting.map((e) => e.name),
    );
  });
});
