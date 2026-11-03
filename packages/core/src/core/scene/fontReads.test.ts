/**
 * Font reads and the memos that key on them: a derivation that read glyph
 * outlines re-derives once a face lands, and one that read none does not.
 */
import { describe, it, expect } from 'vitest';
import { faceGeneration, loadFontOutlines, registerFontOutlines, type OutlineFace } from '@weasel-js/font';
import type { Path } from '@weasel-js/geom';
import { deriveRecorded, emptyDepRecord, sameDeps } from './depMemo';
import { noteFontRead } from './fontReads';
import { addOutsideSource, outsideGeneration, withOutsideReads } from './outsideReads';
import { createPathEffectDerivations } from './pathEffects/derive';
import type { EffectSource } from './pathEffects/source';
import { asNodeId, type DerivedDep, type NodeId } from './types';

const FACE: OutlineFace = {
  unitsPerEm: 1000, ascender: 0.8, advanceOf: () => 0.5, kernOf: () => 0, glyphD: () => '',
};

let faces = 0;
/** Land a face, which moves the face generation. */
async function landFace(): Promise<void> {
  const before = faceGeneration();
  const family = `landed-${faces++}`;
  registerFontOutlines(family, {}, new ArrayBuffer(4), { parser: () => FACE });
  await loadFontOutlines(family);
  expect(faceGeneration()).not.toBe(before);
}

type Pose = { x: number; y: number; width: number; height: number };
const BOX: Path = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };

function depsOf(...ids: string[]) {
  const deps = new Map<NodeId, DerivedDep<Pose>>(ids.map((id) => [asNodeId(id), {
    node: { id: asNodeId(id), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} },
    pose: { x: 0, y: 0, width: 10, height: 10 },
    path: null,
  } as unknown as DerivedDep<Pose>]));
  return { ids: [...deps.keys()], depOf: (id: NodeId) => deps.get(id) };
}

function recorded(readsFonts: boolean) {
  const { ids, depOf } = depsOf('a');
  const record = emptyDepRecord<Pose>();
  deriveRecorded(record, ids.map(depOf), () => { if (readsFonts) noteFontRead(); return null; });
  return { record, ids, depOf };
}

describe('withOutsideReads', () => {
  it('reports a read only when one was noted', () => {
    expect(withOutsideReads(() => 1)).toEqual({ value: 1, outside: false });
    expect(withOutsideReads(() => { noteFontRead(); return 2; })).toEqual({ value: 2, outside: true });
  });

  it('passes a read up to an enclosing call', () => {
    const outer = withOutsideReads(() => withOutsideReads(() => noteFontRead()).outside);
    expect(outer).toEqual({ value: true, outside: true });
  });

  it('recovers after fn throws', () => {
    expect(() => withOutsideReads(() => { noteFontRead(); throw new Error('boom'); })).toThrow('boom');
    expect(withOutsideReads(() => 0).outside).toBe(false);
  });
});

describe('outsideGeneration', () => {
  it('moves when any registered source moves, and stops counting a removed one', () => {
    let mine = 0;
    const remove = addOutsideSource(() => mine);
    const before = outsideGeneration();
    mine = 5;
    expect(outsideGeneration()).toBe(before + 5);
    remove();
    expect(outsideGeneration()).toBe(before);
  });

  it('counts the face generation once fontReads is loaded', async () => {
    const before = outsideGeneration();
    await landFace();
    expect(outsideGeneration()).toBeGreaterThan(before);
  });
});

describe('depMemo with font reads', () => {
  it('a record that read fonts misses once a face lands', async () => {
    const { record, ids, depOf } = recorded(true);
    expect(sameDeps(record, ids, depOf)).toBe(true);
    await landFace();
    expect(sameDeps(record, ids, depOf)).toBe(false);
  });

  it('a record that read no fonts still hits after a face lands', async () => {
    const { record, ids, depOf } = recorded(false);
    await landFace();
    expect(sameDeps(record, ids, depOf)).toBe(true);
  });

  it('a hit on a record that read fonts counts as a read for an enclosing derivation', () => {
    const fonts = recorded(true);
    expect(withOutsideReads(() => sameDeps(fonts.record, fonts.ids, fonts.depOf))).toEqual({ value: true, outside: true });
    const plain = recorded(false);
    expect(withOutsideReads(() => sameDeps(plain.record, plain.ids, plain.depOf)).outside).toBe(false);
  });
});

describe('path effect derivations with font reads', () => {
  function setup(readsFonts: boolean) {
    let reads = 0;
    const derivations = createPathEffectDerivations((): EffectSource => {
      reads++;
      if (readsFonts) noteFontRead();
      return { world: BOX, fill: null, stroke: null };
    });
    const node = { data: { pathEffect: { kind: 'repeatAlong', count: 2 } } };
    const { ids, depOf } = depsOf('shape', 'path');
    const deps = ids.map(depOf);
    return { derive: () => derivations.derivePath(node, deps), reads: () => reads };
  }

  it('re-derives once a face lands when its sources read fonts', async () => {
    const s = setup(true);
    s.derive();
    s.derive();
    expect(s.reads()).toBe(2);
    await landFace();
    s.derive();
    expect(s.reads()).toBe(4);
  });

  it('keeps its result across a face landing when nothing read fonts', async () => {
    const s = setup(false);
    s.derive();
    await landFace();
    s.derive();
    expect(s.reads()).toBe(2);
  });

  it('a hit on a font-reading result counts as a read for the scene memo', () => {
    const s = setup(true);
    s.derive();
    expect(withOutsideReads(() => s.derive()).outside).toBe(true);
    expect(s.reads()).toBe(2);
  });
});
