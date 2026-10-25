import { createScene, type RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { canvasMeasure } from './body';
import { relayoutBodies, type RelayoutScene } from './bodyRelayout';
import { withDiagramRegistry } from './edge';
import { diagramScene } from './fromData';
import { textFace } from './rowStyle';

const FONT = { fontFamily: 'sans-serif', fontSize: 12 };

describe('an italic row', () => {
  it('is set in the italic face', () => {
    expect(textFace({ italic: true, bold: true }, FONT)).toEqual({ ...FONT, fontWeight: 700, fontStyle: 'italic' });
    expect(textFace({}, FONT)).not.toHaveProperty('fontStyle');
  });

  it('is measured in the italic face', () => {
    const ctx = { font: '', measureText: () => ({ width: 10 }) };
    canvasMeasure(ctx)('x', { italic: true, fontSize: 12 });
    expect(ctx.font).toBe('italic 12px sans-serif');
  });

  it('stays italic when its body is laid out again', () => {
    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(),
      initial: diagramScene({ nodes: [{ id: 'a', rows: [{ kind: 'label', text: 'Shape', style: { italic: true } }] }], edges: [] }) as never,
    });
    const seen: unknown[] = [];
    relayoutBodies(scene as unknown as RelayoutScene, ['a'], (_text, s) => { seen.push(s.italic); return { width: 10, height: 10 }; });
    expect(seen).toContain(true);
  });
});
