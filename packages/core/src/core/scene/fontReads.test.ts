/**
 * Font reads and the memos that key on them: a derivation that read glyph
 * outlines re-derives once a face lands, and one that read none does not.
 */
import { describe, it, expect } from 'vitest';
import { faceGeneration, loadFontOutlines, registerFontOutlines, type OutlineFace } from '@weasel-js/font';
import type { Path } from '@weasel-js/geom';
import { deriveRecorded, emptyDepRecord, sameDeps } from './depMemo';
import { noteFontRead, withFontReads } from './fontReads';
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

describe('withFontReads', () => {
  it('reports a read only when one was noted', () => {
    expect(withFontReads(() => 1)).toEqual({ value: 1, fonts: false });
    expect(withFontReads(() => { noteFontRead(); return 2; })).toEqual({ value: 2, fonts: true });
  });

  it('passes a read up to an enclosing call', () => {
    const outer = withFontReads(() => withFontReads(() => noteFontRead()).fonts);
    expect(outer).toEqual({ value: true, fonts: true });
  });

  it('recovers after fn throws', () => {
    expect(() => withFontReads(() => { noteFontRead(); throw new Error('boom'); })).toThrow('boom');
    expect(withFontReads(() => 0).fonts).toBe(false);
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
    expect(withFontReads(() => sameDeps(fonts.record, fonts.ids, fonts.depOf))).toEqual({ value: true, fonts: true });
    const plain = recorded(false);
    expect(withFontReads(() => sameDeps(plain.record, plain.ids, plain.depOf)).fonts).toBe(false);
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
    expect(withFontReads(() => s.derive()).fonts).toBe(true);
    expect(s.reads()).toBe(2);
  });
});
