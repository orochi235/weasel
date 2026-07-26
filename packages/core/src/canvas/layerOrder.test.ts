import { describe, it, expect, vi } from 'vitest';
import { composeOrderedLayers } from './layerOrder';
import type { RenderLayer } from '../core/layers/render';
import type { LayerSlotValue } from './Canvas';

function L(id: string): RenderLayer<unknown> {
  return { id, label: id, space: 'screen', draw: () => [] };
}

describe('composeOrderedLayers', () => {
  it('emits standard slots in STANDARD_SLOTS order when no customs', () => {
    const out = composeOrderedLayers({}, { grid: L('grid'), scene: L('scene'), selectionOverlay: L('sel') });
    expect(out.map(l => l.id)).toEqual(['grid', 'scene', 'sel']);
  });

  it('split scene: emits per-scene-layer canvas layers in order at the scene slot', () => {
    const out = composeOrderedLayers(
      {},
      { grid: L('grid'), selectionOverlay: L('sel') },
      [
        { key: 'scene:zones', layer: L('scene:zones') },
        { key: 'scene:structures', layer: L('scene:structures') },
        { key: 'scene:plantings', layer: L('scene:plantings') },
      ],
    );
    expect(out.map(l => l.id)).toEqual([
      'grid', 'scene:zones', 'scene:structures', 'scene:plantings', 'sel',
    ]);
  });

  it('split scene: a custom can anchor between two scene layers', () => {
    const out = composeOrderedLayers(
      { overlays: { layer: L('overlays'), before: 'scene:plantings' } },
      { grid: L('grid') },
      [
        { key: 'scene:structures', layer: L('scene:structures') },
        { key: 'scene:plantings', layer: L('scene:plantings') },
      ],
    );
    expect(out.map(l => l.id)).toEqual([
      'grid', 'scene:structures', 'overlays', 'scene:plantings',
    ]);
  });

  it('split scene: before/after "scene" brackets the whole scene group', () => {
    const out = composeOrderedLayers(
      {
        under: { layer: L('under'), before: 'scene' },
        over: { layer: L('over'), after: 'scene' },
      },
      {},
      [
        { key: 'scene:zones', layer: L('scene:zones') },
        { key: 'scene:plantings', layer: L('scene:plantings') },
      ],
    );
    expect(out.map(l => l.id)).toEqual(['under', 'scene:zones', 'scene:plantings', 'over']);
  });

  it('emits custom after a standard slot', () => {
    const out = composeOrderedLayers(
      { paraSky: { layer: L('paraSky'), after: 'scene' } },
      { scene: L('scene') },
    );
    expect(out.map(l => l.id)).toEqual(['scene', 'paraSky']);
  });

  it('emits custom before a standard slot', () => {
    const out = composeOrderedLayers(
      { underlay: { layer: L('underlay'), before: 'scene' } },
      { scene: L('scene') },
    );
    expect(out.map(l => l.id)).toEqual(['underlay', 'scene']);
  });

  it('two customs after the same anchor are emitted in insertion order', () => {
    const out = composeOrderedLayers(
      {
        a: { layer: L('a'), after: 'scene' },
        b: { layer: L('b'), after: 'scene' },
      },
      { scene: L('scene') },
    );
    expect(out.map(l => l.id)).toEqual(['scene', 'a', 'b']);
  });

  it('resolves a single-level chain (custom after custom)', () => {
    const out = composeOrderedLayers(
      {
        a: { layer: L('a'), after: 'scene' },
        b: { layer: L('b'), after: 'a' },
      },
      { scene: L('scene') },
    );
    expect(out.map(l => l.id)).toEqual(['scene', 'a', 'b']);
  });

  it('resolves a multi-level chain (the parallax case)', () => {
    const out = composeOrderedLayers(
      {
        sky:        { layer: L('sky'),        after: 'scene' },
        hills:      { layer: L('hills'),      after: 'sky' },
        ground:     { layer: L('ground'),     after: 'hills' },
        foreground: { layer: L('foreground'), after: 'ground' },
      },
      { scene: L('scene') },
    );
    expect(out.map(l => l.id)).toEqual(['scene', 'sky', 'hills', 'ground', 'foreground']);
  });

  it('chains before targets correctly (deepest emitted first)', () => {
    const out = composeOrderedLayers(
      {
        a: { layer: L('a'), before: 'scene' },
        b: { layer: L('b'), before: 'a' },
      },
      { scene: L('scene') },
    );
    expect(out.map(l => l.id)).toEqual(['b', 'a', 'scene']);
  });

  it('customs with no after/before go to tail', () => {
    const out = composeOrderedLayers(
      { tail: { layer: L('tail') } },
      { scene: L('scene') },
    );
    expect(out.map(l => l.id)).toEqual(['scene', 'tail']);
  });

  it('orphan refs go to tail with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = composeOrderedLayers(
      { orphan: { layer: L('orphan'), after: 'nowhere' } },
      { scene: L('scene') },
    );
    expect(out.map(l => l.id)).toEqual(['scene', 'orphan']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('breaks cycles without infinite looping', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = composeOrderedLayers(
      {
        a: { layer: L('a'), after: 'b' },
        b: { layer: L('b'), after: 'a' },
      },
      { scene: L('scene') },
    );
    // Both layers must appear exactly once, scene present, no hang.
    const ids = out.map(l => l.id);
    expect(ids).toContain('scene');
    expect(ids.filter(id => id === 'a')).toHaveLength(1);
    expect(ids.filter(id => id === 'b')).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('emits cellHighlight between grid and scene when present', () => {
    const out = composeOrderedLayers(
      {},
      {
        grid: L('grid'),
        cellHighlight: L('cellHighlight'),
        scene: L('scene'),
        selectionOverlay: L('sel'),
      },
    );
    expect(out.map(l => l.id)).toEqual(['grid', 'cellHighlight', 'scene', 'sel']);
  });

  it('skips entries that are not custom layer entries (null, standard slot configs)', () => {
    // The Canvas's layersMap may include null entries and slot configs.
    // composeOrderedLayers should ignore anything that isn't `{ layer, ... }`.
    const out = composeOrderedLayers(
      {
        scene: { drawOne: () => [] } as unknown as LayerSlotValue<any, any>,
        nothing: null as unknown as LayerSlotValue<any, any>,
        real: { layer: L('real'), after: 'scene' },
      } as any,
      { scene: L('scene') },
    );
    expect(out.map(l => l.id)).toEqual(['scene', 'real']);
  });
});
