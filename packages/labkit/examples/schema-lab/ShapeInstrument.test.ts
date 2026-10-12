import { describe, it, expect } from 'vitest';
import { dashForStrokeStyle } from '@weasel-js/paint';
import { defaultNodeProperties } from '@weasel-js/core';
import { valueAtPath, withValueAtPath } from '@weasel-js/labkit';
import { applyConfig, buildScene, START } from './ShapeInstrument';
import { prefsToFields } from './prefsToFields';

function strokeAfter(config: Record<string, unknown>): Record<string, unknown> {
  const scene = buildScene();
  applyConfig(scene, config);
  return scene.get(scene.roots[0]!)!.data.stroke as unknown as Record<string, unknown>;
}

describe('ShapeProperties applying the rect schema', () => {
  it('holds every field at the path labkit reads its key as', () => {
    const rect = defaultNodeProperties.find((e) => e.name === 'rect')!.schema;
    for (const field of prefsToFields(rect)) {
      expect(valueAtPath(START, field.key), field.key).not.toBeUndefined();
    }
    expect(valueAtPath(START, 'pose.width')).toBe(260);
  });

  it('writes the config onto the node', () => {
    const scene = buildScene();
    applyConfig(scene, withValueAtPath(START, 'pose.x', 33));
    expect(scene.get(scene.roots[0]!)!.pose.x).toBe(33);
  });

  it('edits rotation in the degrees its unit shows, and stores radians', () => {
    const scene = buildScene();
    applyConfig(scene, withValueAtPath(START, 'pose.rotation', 90));
    expect(scene.get(scene.roots[0]!)!.pose.rotation).toBeCloseTo(Math.PI / 2, 12);
    const rect = defaultNodeProperties.find((e) => e.name === 'rect')!.schema;
    const quarter = { ...rect, members: { 'pose.rotation': { kind: 'number' as const, name: 'Rotation', description: '', default: Math.PI / 2, unit: { scale: Math.PI / 180, precision: 1 } } } };
    expect(prefsToFields(quarter)[0]).toMatchObject({ key: 'pose.rotation', default: 90 });
  });

  it('stores a solid style as no dash at all, not the option string', () => {
    const stroke = strokeAfter(START);
    expect('dash' in stroke).toBe(false);
  });

  it('stores a dashed style as the lengths it names at the stroke width', () => {
    const stroke = strokeAfter(withValueAtPath(START, 'data.stroke.dash', 'dashed'));
    expect(stroke.dash).toEqual(dashForStrokeStyle('dashed', 6));
  });

  it('stores no marker as an absent field, not an empty key', () => {
    const stroke = strokeAfter(START);
    expect('markerStart' in stroke).toBe(false);
    expect('markerEnd' in stroke).toBe(false);
  });
});
