/** Outline Stroke on stroked text: the glyphs and their stroke, each as paths. */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { boundsOfPath, type Path } from '@weasel-js/geom';
import { registerFontOutlines, loadFontOutlines } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { TextOutlinesError, type TextNodeSource } from '@weasel-js/text';
import type { ImmediateInvoker } from '@weasel-js/routing';
import type { PathPaint } from 'canvas/nodeShapes/nodePaint';
import { asNodeId } from 'core/scene/types';
import { outlineStrokeAction } from './outlineStrokeAction';
import { stubDeps } from '../testUtils';
import type { CreateOutlinesAdapter } from './createOutlines';
import { applyOutlineStroke } from './outlineStroke';
import { rootsTree } from 'core/adapters/testing/rootsTree';

const INTER_TTF = resolve(import.meta.dirname, '../../../../../../assets/fonts/inter/inter.ttf');
const RED = { color: '#f00' };
const BLUE = { color: '#00f' };
const style = { fontFamily: 'stroke-inter', fontSize: 100 };
const pose = { x: 0, y: 0, width: 200, height: 150 };

function harness(text: TextNodeSource) {
  const made: { path: Path; paint: PathPaint }[] = [];
  const applyOps = vi.fn();
  const adapter: CreateOutlinesAdapter = {
    ...rootsTree(),
    getSelection: () => [asNodeId('label')],
    getTextSource: () => text,
    createPathNode: (path, _sourceId, { fill, stroke }) => {
      made.push({ path, paint: stroke === undefined ? { fill } : { fill, stroke } });
      return { id: `p${made.length}` };
    },
    applyOps,
  };
  return { adapter, made, applyOps };
}

describe('applyOutlineStroke on text', () => {
  beforeEach(async () => {
    _resetFontRegistryForTests();
    _resetFontOutlinesForTests();
    registerFontOutlines('stroke-inter', {}, new Uint8Array(readFileSync(INTER_TTF)).buffer);
    await loadFontOutlines('stroke-inter');
  });

  it('replaces stroked text with its glyphs and, over them, its stroke as a path', () => {
    const h = harness({ data: { text: 'I', style, fill: { paint: BLUE }, stroke: { paint: RED, width: 6 } }, pose });
    const result = applyOutlineStroke(h.adapter);
    expect(result.kind).toBe('applied');
    expect(h.made.map((m) => m.paint)).toEqual([{ fill: { paint: BLUE } }, { fill: { paint: RED } }]);
    const [glyphs, stroke] = h.made.map((m) => boundsOfPath(m.path));
    expect(stroke!.width).toBeCloseTo(glyphs!.width + 6, 1);
  });

  it('gives unfilled stroked text its stroke alone', () => {
    const h = harness({ data: { text: 'I', style, fill: null, stroke: { paint: RED, width: 6 } }, pose });
    applyOutlineStroke(h.adapter);
    expect(h.made.map((m) => m.paint)).toEqual([{ fill: { paint: RED } }]);
  });

  it('keeps the glyphs of an unstroked run beside a stroked one', () => {
    const h = harness({
      data: { text: 'II', style, fill: { paint: BLUE }, runs: [{ text: 'I', stroke: { paint: RED, width: 6 } }, { text: 'I' }] },
      pose,
    });
    applyOutlineStroke(h.adapter);
    expect(h.made.map((m) => m.paint)).toEqual([{ fill: { paint: BLUE } }, { fill: { paint: RED } }, { fill: { paint: BLUE } }]);
  });

  it('leaves text with no stroke alone', () => {
    const h = harness({ data: { text: 'I', style, fill: { paint: BLUE } }, pose });
    expect(applyOutlineStroke(h.adapter)).toEqual({ kind: 'noop', reason: 'no-stroke' });
    expect(h.applyOps).not.toHaveBeenCalled();
  });

  it('fails without changing anything when the face has no outlines', () => {
    const h = harness({
      data: { text: 'I', style: { fontFamily: 'nowhere', fontSize: 40 }, stroke: { paint: RED, width: 6 } }, pose,
    });
    const result = applyOutlineStroke(h.adapter);
    expect(result.kind).toBe('failed');
    expect(result.kind === 'failed' && result.error).toBeInstanceOf(TextOutlinesError);
    expect(h.applyOps).not.toHaveBeenCalled();
  });

  it('the action is enabled on stroked text', () => {
    const h = harness({ data: { text: 'I', style, fill: { paint: { color: '#000' } }, stroke: { paint: RED, width: 6 } }, pose });
    const deps = stubDeps({ selection: { get: () => [asNodeId('label')] }, createOutlinesAdapter: h.adapter });
    expect(outlineStrokeAction.enabled?.(deps)).toBe(true);
    (outlineStrokeAction.invoker as ImmediateInvoker).run(deps, {});
    expect(h.made).toHaveLength(2);
  });
});
