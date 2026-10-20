import { describe, expect, it } from 'vitest';
import { asNodeId, createScene, layoutPages, PathBuilder, type DerivedDep, type Path, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from '../edge';
import { DIAGRAM_OFF_PAGE_TAG, OFF_PAGE_TAG_DERIVE_POSE, offPageFarText, offPageTagSize, offPageTagSpec, offPageTagSpecs, offPageTagText } from './tag';
import { offPageTagOf } from './trait';

const LOOK = { style: { fontFamily: 'sans-serif', fontSize: 10 }, fill: '#111111', background: '#ffffff', padding: 2 };

/** A split connector's path: a stub out of (100, 50) to the right, and one down into (400, 50). */
const STUBS = new PathBuilder().moveTo(100, 50).lineTo(124, 50).moveTo(400, 26).lineTo(400, 50).build();

const edgeDep = (path: Path | null): DerivedDep<RectPose> => ({
  node: { id: asNodeId('e'), kind: 'leaf', layer: 'main', parent: null, pose: { x: 0, y: 0, width: 0, height: 0 }, data: {} } as never,
  pose: { x: 0, y: 0, width: 0, height: 0 },
  path,
});

const tagAt = (end: 'from' | 'to', path: Path | null) => {
  const spec = offPageTagSpec('e', end, 'Page 2 · A', { ...LOOK, layer: 'main' });
  return OFF_PAGE_TAG_DERIVE_POSE({ pose: spec.pose, data: spec.data }, [edgeDep(path)]) as RectPose | null;
};

describe('off-page tags', () => {
  it('reads the far page and the ref, sized to its text and padding', () => {
    expect(offPageTagText('Page 2', 'A')).toBe('Page 2 · A');
    // 10 characters at 0.6 of a 10-unit face, plus 2 of padding each side.
    expect(offPageTagSize('Page 2 · A', LOOK)).toEqual({ width: 64, height: 14 });
  });

  it('is a text node with a background, named for its connector and end', () => {
    const spec = offPageTagSpec('e', 'to', 'Page 1 · A', { ...LOOK, layer: 'main' });
    expect(spec.id).toBe('e/offpage-to');
    expect(spec.dependsOn).toEqual(['e']);
    expect(spec.data).toMatchObject({ text: 'Page 1 · A', background: { paint: { color: '#ffffff' } }, padding: 2 });
    expect(offPageTagOf(spec)).toEqual({ edge: 'e', end: 'to' });
  });

  it('stations past the tip of its own stub, on the side away from the shape', () => {
    // The start stub runs right to x = 124: the tag's left side 2 past it, centered on y = 50.
    expect(tagAt('from', STUBS)).toEqual({ x: 126, y: 43, width: 64, height: 14 });
    // The end stub comes down into its shape from y = 26: the tag's bottom 2 above that.
    expect(tagAt('to', STUBS)).toEqual({ x: 368, y: 10, width: 64, height: 14 });
  });

  it('keeps its own pose while its connector draws no stub at its end', () => {
    expect(tagAt('to', new PathBuilder().moveTo(0, 0).lineTo(10, 0).build())).toBeNull();
    expect(tagAt('from', null)).toBeNull();
  });

  it('round-trips through toJSON by its registry key', () => {
    const registry = withDiagramRegistry<RectPose>();
    expect(registry.derivePose?.[DIAGRAM_OFF_PAGE_TAG]).toBe(OFF_PAGE_TAG_DERIVE_POSE);
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    scene.add(offPageTagSpec(a, 'from', 'Page 2 · A', { ...LOOK, layer: 'main' }) as never);
    const json = scene.toJSON();
    expect(json.nodes.find((n) => n.id === `${a}/offpage-from`)?.derivePoseKey).toBe(DIAGRAM_OFF_PAGE_TAG);
  });
});

const pages = layoutPages([{ id: 'p1', width: 200, height: 100 }, { id: 'p2', name: 'Detail', width: 200, height: 100 }]);

describe('offPageFarText', () => {
  it('names the page at the other end, by its name or its place', () => {
    const split = { ref: 'A', from: 'p1', to: 'p2' };
    expect(offPageFarText(pages, split, 'from')).toBe('Detail · A');
    expect(offPageFarText(pages, split, 'to')).toBe('Page 1 · A');
  });
  it('falls back to the page id when that page is gone', () => {
    expect(offPageFarText(pages, { ref: 'B', from: 'p1', to: 'gone' }, 'from')).toBe('gone · B');
  });
});

it('offPageTagSpecs makes the from tag then the to tag, each depending on the edge', () => {
  const specs = offPageTagSpecs('e1', { ref: 'A', from: 'p1', to: 'p2' }, pages, { ...LOOK, layer: 'main' });
  expect(specs.map((s) => s.id)).toEqual(['e1/offpage-from', 'e1/offpage-to']);
  expect(specs.every((s) => s.dependsOn?.[0] === 'e1')).toBe(true);
  expect((specs[0]!.data as { text: string }).text).toBe('Detail · A');
});
