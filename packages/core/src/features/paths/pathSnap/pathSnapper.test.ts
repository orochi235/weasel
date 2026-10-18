import { describe, expect, it, vi } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { asNodeId } from 'core/scene/types';
import { createPathSnapper } from './pathSnapper';
import { createPathSnapMarkerLayer } from './pathSnapMarkerLayer';

const ONE = { x: 1, y: 1 };

function sceneOf(paths: Record<string, string>) {
  let version = 1;
  const nodes = new Map(Object.entries(paths).map(([id, d]) => [
    asNodeId(id), { id: asNodeId(id), kind: 'leaf' as const, layer: 'default', parent: null, pose: pathFromD(d), data: {} },
  ]));
  return { nodes, layers: [{ id: 'default' }], getVersion: () => version, bump: () => { version++; } };
}

describe('createPathSnapper', () => {
  const scene = sceneOf({ a: 'M0 0 L100 100', b: 'M0 100 L100 0' });

  it('snaps nothing until configured', () => {
    const s = createPathSnapper(scene as never);
    expect(s.snap({ x: 51, y: 50 }, undefined, ONE)).toBeNull();
    s.configure({});
    expect(s.snap({ x: 51, y: 50 }, undefined, ONE)).toEqual({ x: 50, y: 50 });
    expect(s.mark()).toEqual({ kind: 'intersection', x: 50, y: 50 });
  });

  it('measures its radius in screen pixels', () => {
    const s = createPathSnapper(scene as never);
    s.configure({ radius: 8, kinds: { nearest: false, midpoint: false } });
    expect(s.snap({ x: 55, y: 50 }, undefined, ONE)).not.toBeNull();
    expect(s.snap({ x: 55, y: 50 }, undefined, { x: 4, y: 4 })).toBeNull();
  });

  it('turns a kind off, and skips what the query excludes', () => {
    const s = createPathSnapper(scene as never);
    s.configure({ kinds: { intersection: false, nearest: false, midpoint: false } });
    expect(s.snap({ x: 51, y: 50 }, undefined, ONE)).toBeNull();
    s.configure({});
    expect(s.mark()).toBeNull();
    s.snap({ x: 51, y: 50 }, { exclude: ['b'] }, ONE);
    expect(s.mark()?.kind).not.toBe('intersection');
    s.snap({ x: 51, y: 50 }, { include: ['b'] }, ONE);
    expect(s.mark()?.kind).toBe('midpoint');
  });

  it('reindexes when the scene version moves', () => {
    const live = sceneOf({ a: 'M0 0 L100 100' });
    const s = createPathSnapper(live as never);
    s.configure({ kinds: { intersection: true, nearest: false, midpoint: false } });
    expect(s.snap({ x: 50, y: 50 }, undefined, ONE)).toBeNull();
    live.nodes.set(asNodeId('b'), { ...live.nodes.get(asNodeId('a'))!, id: asNodeId('b'), pose: pathFromD('M0 100 L100 0') });
    live.bump();
    expect(s.snap({ x: 50, y: 50 }, undefined, ONE)).toEqual({ x: 50, y: 50 });
  });

  it('offers nothing on a hidden or an annotation layer', () => {
    const s = createPathSnapper({ ...scene, layers: [{ id: 'default', visible: false }] } as never);
    s.configure({});
    expect(s.snap({ x: 51, y: 50 }, undefined, ONE)).toBeNull();
    const notes = createPathSnapper({ ...scene, layers: [{ id: 'default', annotation: true }] } as never);
    notes.configure({});
    expect(notes.snap({ x: 51, y: 50 }, undefined, ONE)).toBeNull();
  });

  it('offers nothing from a hidden node, or from under a hidden container', () => {
    const live = sceneOf({ a: 'M0 0 L100 100', b: 'M0 100 L100 0' });
    const s = createPathSnapper(live as never);
    s.configure({ kinds: { intersection: true, nearest: false, midpoint: false } });
    expect(s.snap({ x: 50, y: 50 }, undefined, ONE)).toEqual({ x: 50, y: 50 });
    live.nodes.set(asNodeId('g'), { ...live.nodes.get(asNodeId('a'))!, id: asNodeId('g'), kind: 'container' as never, hidden: true } as never);
    live.nodes.set(asNodeId('b'), { ...live.nodes.get(asNodeId('b'))!, parent: asNodeId('g') } as never);
    live.bump();
    expect(s.snap({ x: 50, y: 50 }, undefined, ONE)).toBeNull();
  });

  it('tells subscribers when the mark changes, and release clears it', () => {
    const s = createPathSnapper(scene as never);
    s.configure({});
    const heard = vi.fn();
    s.subscribe(heard);
    s.snap({ x: 51, y: 50 }, undefined, ONE);
    s.snap({ x: 50, y: 51 }, undefined, ONE);
    expect(heard).toHaveBeenCalledTimes(1);
    s.release();
    expect(s.mark()).toBeNull();
    expect(heard).toHaveBeenCalledTimes(2);
  });
});

describe('createPathSnapMarkerLayer', () => {
  const view = { x: 0, y: 0, scale: { x: 2, y: 2 } } as never;

  it("draws the mark's glyph on it and names its kind", () => {
    const s = createPathSnapper(sceneOf({ a: 'M0 0 L100 100', b: 'M0 100 L100 0' }) as never);
    s.configure({});
    const layer = createPathSnapMarkerLayer(s);
    expect(layer.draw(null, view, { width: 0, height: 0 } as never)).toEqual([]);
    s.snap({ x: 51, y: 50 }, undefined, ONE);
    const [glyph, label] = layer.draw(null, view, { width: 0, height: 0 } as never);
    expect(glyph.kind).toBe('path');
    expect(label).toMatchObject({ kind: 'text', runs: [expect.objectContaining({ text: 'intersection' })] });
  });

  it('draws nothing with the marker turned off', () => {
    const s = createPathSnapper(sceneOf({ a: 'M0 0 L100 100', b: 'M0 100 L100 0' }) as never);
    s.configure({ marker: false });
    s.snap({ x: 51, y: 50 }, undefined, ONE);
    expect(createPathSnapMarkerLayer(s).draw(null, view, { width: 0, height: 0 } as never)).toEqual([]);
  });
});

describe('what a node offers to snap to', () => {
  const leaf = (id: string, pose: unknown, data: unknown) =>
    [asNodeId(id), { id: asNodeId(id), kind: 'leaf' as const, layer: 'default', parent: null, pose, data }] as const;

  it("gives a text node's box: its corners and its center", () => {
    const nodes = new Map([leaf('t', { x: 0, y: 0, width: 100, height: 40 }, { text: 'hi' })]);
    const s = createPathSnapper({ nodes, layers: [{ id: 'default' }], getVersion: () => 1 } as never);
    s.configure({ kinds: { nearest: false, midpoint: false } });
    expect(s.snap({ x: 51, y: 21 }, undefined, ONE)).toEqual({ x: 50, y: 20 });
    expect(s.mark()?.kind).toBe('center');
    expect(s.snap({ x: 98, y: 2 }, undefined, ONE)).toEqual({ x: 100, y: 0 });
    expect(s.mark()?.kind).toBe('anchor');
  });

  it("gives a filled rectangle its drawn outline", () => {
    const nodes = new Map([leaf('r', { x: 10, y: 10, width: 50, height: 30 }, { fill: { paint: { color: '#000' } } })]);
    const s = createPathSnapper({ nodes, layers: [{ id: 'default' }], getVersion: () => 1 } as never);
    s.configure({ kinds: { nearest: false } });
    expect(s.snap({ x: 58, y: 38 }, undefined, ONE)).toEqual({ x: 60, y: 40 });
    expect(s.snap({ x: 35, y: 12 }, undefined, ONE)).toEqual({ x: 35, y: 10 });
  });
});
