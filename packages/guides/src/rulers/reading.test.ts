import { describe, expect, it } from 'vitest';
import { asNodeId, createScene, type AddNodeSpec, type RectPose, type UnitScope } from '@weasel-js/core';
import { METRIC_MM } from '@weasel-js/quantity';
import { documentRulerFrame, rulerFrameAt } from './reading';

type Spec = AddNodeSpec<object, 'main', RectPose>;
const PT: UnitScope = { system: { base: 'pt', units: { pt: 1, in: 72 } } };
const MM: UnitScope = { system: METRIC_MM, scale: 72 / 25.4 };

const spec = (id: string, extra: Partial<Spec> = {}): Spec =>
  ({ id: asNodeId(id), kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {}, ...extra });
const sceneOf = (specs: Spec[]) =>
  createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], initial: specs }) as never;

describe('rulerFrameAt', () => {
  const scene = sceneOf([
    spec('part', { kind: 'group', units: MM, pose: { x: 100, y: 50, width: 200, height: 100 } }),
    spec('bolt', { parent: asNodeId('part') }),
  ]);
  const at = rulerFrameAt(scene, PT, { x: 5, y: 5 });

  it('reads the document outside every frame, from the origin it is given', () => {
    expect(at({ x: 10, y: 10 })).toEqual(documentRulerFrame(PT, { x: 5, y: 5 }));
  });

  it("reads a frame's scope chain from its box's origin inside it", () => {
    expect(at({ x: 150, y: 80 })).toEqual({ id: asNodeId('part'), scopes: [PT, MM], origin: { x: 100, y: 50 } });
  });

  it('reads the document from world zero by default', () => {
    expect(documentRulerFrame(PT).origin).toEqual({ x: 0, y: 0 });
  });
});
