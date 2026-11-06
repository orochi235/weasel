import { describe, expect, it } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core';
import { HEADER_PAD } from './body';
import { withDiagramRegistry } from './edge';
import { diagramScene } from './fromData';
import { onHeaderBand } from './headerClick';

const specs = diagramScene({
  nodes: [
    { id: 'h', at: { x: 100, y: 50 }, rows: [{ kind: 'header', text: 'Title' }, { kind: 'label', text: 'body' }] },
    { id: 'p', at: { x: 300, y: 50 }, rows: [{ kind: 'label', text: 'plain' }] },
  ],
  edges: [],
}, { layout: 'none', font: { fontFamily: 'sans-serif', fontSize: 10 } });
const scene = createScene<never, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(), initial: specs as never });
const band = 14 + HEADER_PAD * 2;

describe('onHeaderBand', () => {
  it('is true over the band and false below it', () => {
    expect(onHeaderBand(scene as never, 'h', { x: 110, y: 50 + band / 2 })).toBe(true);
    expect(onHeaderBand(scene as never, 'h', { x: 110, y: 50 + band + 2 })).toBe(false);
  });

  it('is false on a body without a header', () => {
    expect(onHeaderBand(scene as never, 'p', { x: 310, y: 52 })).toBe(false);
  });
});
