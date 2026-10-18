import { describe, it, expect } from 'vitest';
import type { PathDrawCommand } from '@weasel-js/renderer';
import { buildDebugOverlayCommands } from './createDebugOverlayLayer';
import { createDebugSink } from './createDebugSink';
import { DEFAULT_DEBUG_THEME } from './defaultTheme';

const DIMS = { width: 800, height: 600 };
const VIEW = { x: 0, y: 0, scale: { x: 2, y: 2 } };
const BOX = { x: 5, y: 5, width: 10, height: 10 };

describe('the highlight overlay feature', () => {
  it('records the bounds of a highlighted node only, with bounds off', () => {
    const sink = createDebugSink({ highlight: ['a'] });
    sink.recordBounds('a', BOX);
    sink.recordBounds('b', BOX);
    expect(sink.snapshot().bounds.map((b) => b.id)).toEqual(['a']);
  });

  it('outlines each highlighted node in the highlight color, through the view', () => {
    const config = { bounds: true, highlight: ['b'] };
    const sink = createDebugSink(config);
    sink.recordBounds('a', BOX);
    sink.recordBounds('b', BOX);
    const highlights = buildDebugOverlayCommands(sink.snapshot(), config, VIEW, DIMS)
      .filter((c): c is PathDrawCommand => c.kind === 'path' && c.stroke?.paint.kind === 'solid'
        && c.stroke.paint.color === DEFAULT_DEBUG_THEME.highlight);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]!.path).toMatchObject({ width: 20, height: 20 });
  });
});
