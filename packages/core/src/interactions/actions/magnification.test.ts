import { describe, expect, it } from 'vitest';
import type { UnitScope } from '@weasel-js/quantity';
import { createScene } from 'core/scene/scene';
import { asNodeId, type AddNodeSpec, type RectPose } from 'core/scene/types';
import { undeclaredMagnifications } from './magnification';

type Spec = AddNodeSpec<object, 'main', RectPose>;
const IN = { system: { base: 'in', units: { in: 1 } } } satisfies UnitScope;
const BOX = { x: 0, y: 0, width: 48, height: 48 };

const spec = (id: string, extra: Partial<Spec> = {}): Spec =>
  ({ id: asNodeId(id), kind: 'mark', layer: 'main', pose: { ...BOX }, data: {}, ...extra });
const sceneOf = (specs: Spec[]) =>
  createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], initial: specs }) as never;

/** A board in inches holding an inset whose own transform draws its children at `s`. */
const board = (s: number, inset: UnitScope = IN) => sceneOf([
  spec('board', { kind: 'group', units: IN }),
  spec('inset', { parent: asNodeId('board'), pose: { ...BOX, transform: [s, 0, 0, s] }, units: inset }),
  spec('cabinet', { parent: asNodeId('inset'), pose: { x: 0, y: 0, width: 20, height: 20 } }),
]);

describe('undeclaredMagnifications', () => {
  it('finds a container drawing its children at a scale no scope declares', () => {
    expect(undeclaredMagnifications(board(1.5))).toEqual([
      { id: asNodeId('inset'), drawn: { x: 1.5, y: 1.5 }, declared: 1 },
    ]);
  });

  it('accepts one whose scope declares the scale it is drawn at', () => {
    expect(undeclaredMagnifications(board(0.4, { ...IN, drawnAt: 0.4 }))).toEqual([]);
  });

  it('flags a declaration with nothing drawing it', () => {
    expect(undeclaredMagnifications(board(1, { ...IN, drawnAt: 0.4 }))).toEqual([
      { id: asNodeId('inset'), drawn: { x: 1, y: 1 }, declared: 0.4 },
    ]);
  });

  it('reads nothing in a scene that declares no units', () => {
    const scene = sceneOf([
      spec('g', { kind: 'group' }),
      spec('inner', { parent: asNodeId('g'), pose: { ...BOX, transform: [2, 0, 0, 2] } }),
      spec('leaf', { parent: asNodeId('inner') }),
    ]);
    expect(undeclaredMagnifications(scene)).toEqual([]);
  });

  it('reads a turned frame by its scale, not its rotation', () => {
    const c = Math.cos(0.5) * 0.4;
    const s = Math.sin(0.5) * 0.4;
    const scene = sceneOf([
      spec('board', { kind: 'group', units: IN }),
      spec('inset', { parent: asNodeId('board'), pose: { ...BOX, transform: [c, s, -s, c] }, units: { ...IN, drawnAt: 0.4 } }),
      spec('cabinet', { parent: asNodeId('inset') }),
    ]);
    expect(undeclaredMagnifications(scene)).toEqual([]);
  });
});
