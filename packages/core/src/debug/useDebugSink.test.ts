import { describe, it, expect } from 'vitest';
import type { RenderLayer } from 'core/layers/render';
import { createDebugSink } from './createDebugSink';
import { beginDebugFrame } from './useDebugSink';

const layer = (id: string): RenderLayer<unknown> => ({ id, label: id, draw: () => [] });

describe('beginDebugFrame', () => {
  it('records the stack as painted: hidden layers dropped, in draw order, numbered by it', () => {
    const sink = createDebugSink({ layers: true });
    const layers = [layer('grid'), layer('selection'), layer('scene')];
    beginDebugFrame(sink, false, layers, { grid: false }, ['scene', 'grid', 'selection']);
    expect(sink.snapshot().layers.map((l) => [l.index, l.id])).toEqual([[0, 'scene'], [1, 'selection']]);
  });
});
