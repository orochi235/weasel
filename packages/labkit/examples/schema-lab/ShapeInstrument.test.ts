import { describe, it, expect } from 'vitest';
import { dashForStrokeStyle } from '@weasel-js/paint';
import { defaultNodeProperties } from '@weasel-js/core';
import { resolveConfigSchema, schemaNodeAtPath, valueAtPath, withValueAtPath } from '@weasel-js/labkit';
import { prefSectionLeaves } from '@weasel-js/prefs';
import { applyConfig, buildScene, ShapeInstrument, START } from './ShapeInstrument';

const RECT = defaultNodeProperties.find((e) => e.name === 'rect')!.schema;

function strokeAfter(config: Record<string, unknown>): Record<string, unknown> {
  const scene = buildScene();
  applyConfig(scene, config);
  return scene.get(scene.roots[0]!)!.data.stroke as unknown as Record<string, unknown>;
}

describe('ShapeProperties applying the rect schema', () => {
  it('declares its config as the rect schema, every leaf at the path its key names', () => {
    const resolved = resolveConfigSchema(ShapeInstrument.config!, []);
    for (const [path, leaf] of prefSectionLeaves(RECT.members)) {
      expect(schemaNodeAtPath(resolved.group, path), path).toMatchObject({ kind: leaf.kind, name: leaf.name });
    }
    expect(valueAtPath(START, 'pose.width')).toBe(260);
  });

  it('writes the config onto the node', () => {
    const scene = buildScene();
    applyConfig(scene, withValueAtPath(START, 'pose.x', 33));
    expect(scene.get(scene.roots[0]!)!.pose.x).toBe(33);
  });

  it('holds rotation in radians, as the node does, and keeps the unit the panel edits it in', () => {
    const scene = buildScene();
    applyConfig(scene, withValueAtPath(START, 'pose.rotation', Math.PI / 2));
    expect(scene.get(scene.roots[0]!)!.pose.rotation).toBeCloseTo(Math.PI / 2, 12);
    const resolved = resolveConfigSchema(ShapeInstrument.config!, []);
    expect(schemaNodeAtPath(resolved.group, 'pose.rotation')).toHaveProperty('unit');
  });

  it('holds the stroke whole, so a solid style is no dash at all', () => {
    const stroke = strokeAfter(START);
    expect('dash' in stroke).toBe(false);
    expect('markerStart' in stroke).toBe(false);
  });

  it('writes a dash the panel stored onto the node as it is', () => {
    const stroke = strokeAfter(withValueAtPath(START, 'data.stroke.dash', dashForStrokeStyle('dashed', 6)));
    expect(stroke.dash).toEqual(dashForStrokeStyle('dashed', 6));
  });

  it('leaves the skew out of the config, which an absent transform reads as off', () => {
    expect(valueAtPath(START, 'pose.transform')).toBeUndefined();
  });
});
