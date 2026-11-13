/**
 * A `kit:text` node with `fit: 'shrink'` is painted, picked, caret-placed and
 * edited at the one fitted size. The face draws each glyph as a bar on a 0.6 em
 * advance, so the text's width follows its size exactly.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { registerFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { isTextData, loadTextOutlines, textFitScale, type ResolvedRun } from '@weasel-js/text';
import type { TextDrawCommand } from '@weasel-js/renderer';
import { useScene } from '../../core/scene/useScene';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { TEXT_PAINTER, textPoseOf, type TextNodeData } from '../../canvas/nodeShapes/textPainter';
import { textHitAt, type TextReads } from './textHitAt';
import { useSceneTextEdit } from './useSceneTextEdit';

const BARS: OutlineFace = {
  unitsPerEm: 1000, ascender: 0.8, advanceOf: () => 0.6, kernOf: () => 0, glyphD: () => 'M0 -0.5L0.2 -0.5L0.2 0L0 0Z',
};

const DATA: TextNodeData = {
  text: 'HEADLINE', style: { fontFamily: 'bars', fontSize: 100 }, fill: { paint: { kind: 'solid', color: '#000' } },
  fit: 'shrink',
};
const POSE: RectPose = { x: 100, y: 50, width: 240, height: 200 };

beforeEach(async () => {
  document.body.innerHTML = '';
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
  registerFontOutlines('bars', {}, new ArrayBuffer(4), { parser: () => BARS });
  await loadTextOutlines({ text: DATA.text, style: DATA.style });
});

const fitted = () => textFitScale(textPoseOf(DATA, POSE));

const node = (data: TextNodeData = DATA) => ({
  id: asNodeId('t'), kind: 'mark' as const, layer: 'default', parent: null, pose: POSE, data,
});

function textRuns(data: TextNodeData): readonly ResolvedRun[] {
  const cmds = TEXT_PAINTER.paint!(node(data) as never, POSE, undefined as never) as readonly TextDrawCommand[];
  return cmds.find((c) => c.kind === 'text')!.runs;
}

describe("a kit:text node with fit: 'shrink'", () => {
  it('fits the box below its own size', () => {
    const k = fitted();
    expect(k).toBeLessThan(1);
    expect(k).toBeGreaterThan(0.4);
  });

  it('paints its glyphs at the fitted size', () => {
    expect(textRuns(DATA)[0]!.fontSize).toBeLessThan(100);
    expect(textRuns(DATA)[0]!.fontSize).toBeCloseTo(100 * fitted(), 9);
    expect(textRuns({ ...DATA, fit: undefined })[0]!.fontSize).toBe(100);
  });

  it('is picked by the lines it paints', () => {
    const silhouette = TEXT_PAINTER.silhouette!(node() as never, POSE, undefined as never)!;
    const own = TEXT_PAINTER.silhouette!(node({ ...DATA, fit: undefined }) as never, POSE, undefined as never)!;
    const width = (p: typeof silhouette) => (p.kind === 'polygon' ? Math.max(...[...p.coords].filter((_, i) => i % 2 === 0)) : 0);
    expect(width(silhouette)).toBeLessThanOrEqual(POSE.x + POSE.width + 1e-6);
    expect(width(own)).toBeGreaterThan(POSE.x + POSE.width);
  });

  it('places the caret where the fitted glyphs are', () => {
    const READ: TextReads<unknown> = {
      isText: isTextData,
      text: (d) => (d as TextNodeData).text,
      style: (d) => (d as TextNodeData).style,
      runs: () => undefined,
      verticalAlign: () => undefined,
      padding: () => undefined,
      fit: (d) => (d as TextNodeData).fit,
    };
    const scene = createScene<unknown, 'default', RectPose>({
      systemLayers: [{ id: 'default' }],
      initial: [{ id: asNodeId('t'), kind: 'mark', layer: 'default', pose: POSE, data: DATA }],
    });
    // Past the fourth fitted glyph's middle: a caret after it, where unfitted it would land in the second.
    const x = POSE.x + 60 * fitted() * 3.75;
    expect(textHitAt(scene, READ, x, POSE.y + 10)!.caret).toBe(4);
  });

  it('opens its editor at the fitted size: its own size under a zoom smaller by the fit', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(document.createElement('canvas'));
    const hook = renderHook(() => {
      const scene = useScene({ items: [{ id: 't', ...POSE, ...DATA }] });
      return useSceneTextEdit(scene, container);
    });
    act(() => hook.result.current.startEdit('t'));
    const el = container.querySelector<HTMLDivElement>('div[contenteditable="true"]')!;
    const k = fitted();
    expect(el.style.fontSize).toBe('100px');
    expect(el.style.transform).toBe(`scale(${k})`);
    expect(parseFloat(el.style.minWidth)).toBeCloseTo(POSE.width / k, 6);
  });
});
