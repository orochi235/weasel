/**
 * Lookups keyed by a name that comes from outside the table — a rig, a joint, a layer, a tool id, a node-fn key, a
 * shape kind — answer for that table's own entries only, so a name like `toString` or `__proto__` reads as unset
 * rather than reaching `Object.prototype`.
 */
import { describe, expect, it } from 'vitest';
import { rectPath } from '@weasel-js/geom';
import { sceneClipTargets } from './animation/clipTargets';
import { remapSkin } from './animation/rig/skinBinding';
import { builtLayersOf } from './canvas/layerSlots';
import { createPathOverlay } from './canvas/pathOverlay';
import { insertBuilds } from './canvas/SceneCanvas/presetTraits';
import { presetOwnTools, resolveFeatures } from './canvas/SceneCanvas/features';
import { createNodeFnFields } from './core/scene/nodeFnFields';
import { samePoseValue } from './core/scene/poseSnapshot';
import { shapeKindInfo } from './core/shapeKinds';
import type { Tool } from './tools/overlayBinding';

const fromJson = <T>(text: string): T => JSON.parse(text) as T;

describe('own-key lookups', () => {
  it('a clip naming rig:toString targets nothing', () => {
    const target = sceneClipTargets({} as never, { rigs: {} });
    expect(target('rig:toString')).toBeUndefined();
  });

  it('a skin with a joint named __proto__ keeps it as a joint', () => {
    const skin = fromJson<Record<string, number[]>>('{"__proto__": [1]}');
    const out = remapSkin(skin as never, [{ a: 0, b: 0, t: 0 }]) as Record<string, number[]>;
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(out, '__proto__')?.value).toEqual([1]);
  });

  it('a layer map with an own __proto__ slot leaves the built map’s prototype alone', () => {
    const map = fromJson<Record<string, unknown>>('{"__proto__": null}');
    const out = builtLayersOf(map);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.hasOwn(out, '__proto__')).toBe(true);
  });

  it('a transient path whose role is toString paints as chrome', () => {
    const overlay = createPathOverlay({ id: 't' });
    overlay.set([{ path: rectPath(0, 0, 1, 1), role: 'toString' }]);
    const plain = createPathOverlay({ id: 'c' });
    plain.set([{ path: rectPath(0, 0, 1, 1) }]);
    const draw = (o: typeof overlay) => o.layer.draw({}, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 1, height: 1, dpr: 1 });
    expect(draw(overlay)).toEqual(draw(plain));
  });

  it('an insert of kind constructor builds nothing without a factory for it', () => {
    expect(insertBuilds('constructor', {}, new Set())).toBe(false);
  });

  it('a preset tool with the id __proto__ is registered as a tool', () => {
    const tool = { id: '__proto__', eligibility: { focus: true } } as unknown as Tool;
    const out = presetOwnTools(resolveFeatures([{ id: 'p', tools: [tool] }]));
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.hasOwn(out, '__proto__')).toBe(true);
  });

  it('a snapshot naming the node-fn key toString restores no function', () => {
    const [field] = createNodeFnFields({ clipFromPose: {} } as never);
    expect(field!.fnOf('toString')).toBeUndefined();
  });

  it('samePoseValue finds a field the value lacks even when it names an Object.prototype member', () => {
    expect(samePoseValue({ toString: Object.prototype.toString }, {})).toBe(false);
  });

  it('shapeKindInfo knows no kind named toString', () => {
    expect(shapeKindInfo('toString')).toBeUndefined();
  });
});
