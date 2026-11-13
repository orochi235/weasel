/**
 * `fit: 'shrink'` against a real face, the bundled Inter read as an outline
 * face, so every reader below measures with the same glyph advances.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadFontOutlines, registerFontOutlines } from '@weasel-js/font';
import { _resetFontOutlinesForTests, _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { boundsOfPath } from '@weasel-js/geom';
import { _resetLayoutCacheForTests } from './test-seams';
import { layoutTextPose, textFitScale, textPoseLayoutInput } from './layout/textPoseLayout';
import { TEXT_FIT_TOLERANCE, scaleRuns } from './layout/textFit';
import { layoutRuns } from './layout/layoutRuns';
import { fittedTextPose } from './fittedTextPose';
import { fitTextPose } from './fitTextPose';
import { measureTextBounds } from './measure/measureTextBounds';
import { textLineBoxes } from './measure/lineBoxes';
import { caretIndexAt } from './hitTest';
import { textToPath } from './textToPath';
import type { TextPose } from './pose';

const INTER = resolve(import.meta.dirname, '../../../assets/fonts/inter/inter.ttf');

function ttf(): ArrayBuffer {
  const buf = readFileSync(INTER);
  const out = new ArrayBuffer(buf.byteLength);
  new Uint8Array(out).set(buf);
  return out;
}

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
  registerFontOutlines('fit-inter', {}, ttf());
  await loadFontOutlines('fit-inter');
});

const INK = { paint: { kind: 'solid', color: '#000' } } as const;

/** A headline at 100 units, which runs past a 300-wide box. */
function headline(extra: Partial<TextPose> = {}): TextPose {
  return {
    x: 10, y: 20, width: 300, height: 200, text: 'HEADLINE',
    style: { fontFamily: 'fit-inter', fontSize: 100 }, fill: INK, fit: 'shrink', ...extra,
  };
}

const boundsOf = (pose: TextPose) => layoutTextPose(pose).laid.bounds;

describe("fit: 'shrink'", () => {
  it('sets the text at the largest size whose lines fit the box', () => {
    const pose = headline();
    const k = textFitScale(pose);
    expect(k).toBeLessThan(1);
    expect(boundsOf(pose).width).toBeLessThanOrEqual(pose.width + 1e-6);
    expect(boundsOf(pose).height).toBeLessThanOrEqual(pose.height);
    // A size a tolerance larger runs past the box.
    const { runs, opts } = textPoseLayoutInput({ ...pose, fit: 'none' });
    expect(layoutRuns(scaleRuns(runs, k * (1 + 2 * TEXT_FIT_TOLERANCE)), opts).bounds.width).toBeGreaterThan(pose.width);
  });

  it('scales every run, an absolute size and tracking among them', () => {
    const pose = headline({
      text: 'HEAD LINE',
      runs: [{ text: 'HEAD ' }, { text: 'LINE', fontSize: 60, letterSpacing: { px: 4 } }],
    });
    const k = textFitScale(pose);
    const { runs, style } = textPoseLayoutInput(pose);
    expect(style.fontSize).toBeCloseTo(100 * k, 9);
    expect(runs[0]!.fontSize).toBeCloseTo(100 * k, 9);
    expect(runs[1]!.fontSize).toBeCloseTo(60 * k, 9);
    expect(runs[1]!.letterSpacing).toBeCloseTo(4 * k, 9);
  });

  it('never sets the text above its own size', () => {
    const pose = headline({ text: 'Hi', width: 2000, height: 2000 });
    expect(textFitScale(pose)).toBe(1);
    expect(textPoseLayoutInput(pose).runs[0]!.fontSize).toBe(100);
  });

  it('fits the height of wrapped text, wrapping at the box width as the size drops', () => {
    const pose = headline({ text: 'ONE TWO THREE FOUR FIVE SIX', width: 400, height: 150, style: { fontFamily: 'fit-inter', fontSize: 100, wrap: true } });
    const k = textFitScale(pose);
    expect(k).toBeLessThan(1);
    const { laid } = layoutTextPose(pose);
    expect(laid.bounds.height).toBeLessThanOrEqual(150);
    expect(laid.bounds.width).toBeLessThanOrEqual(400);
    expect(laid.lines.length).toBeGreaterThan(1);
  });

  it('answers the same scale every time', () => {
    expect(textFitScale(headline())).toBe(textFitScale(headline()));
    _resetLayoutCacheForTests();
    const again = textFitScale(headline());
    _resetLayoutCacheForTests();
    expect(textFitScale(headline())).toBe(again);
  });

  it('outlines the glyphs at the fitted size', () => {
    const pose = headline();
    const fitted = boundsOfPath(textToPath({ ...pose, fit: 'shrink' }, pose));
    const own = boundsOfPath(textToPath({ ...pose, fit: undefined }, pose));
    expect(fitted.width).toBeLessThanOrEqual(pose.width);
    expect(fitted.width / own.width).toBeCloseTo(textFitScale(pose), 2);
  });

  it('measures, picks and places the caret at the fitted size', () => {
    const pose = headline();
    const laid = boundsOf(pose);
    const measured = measureTextBounds(pose.text, pose.style, { fitBox: { width: pose.width, height: pose.height } });
    expect(measured.width).toBeCloseTo(laid.width, 6);
    expect(measured.height).toBeCloseTo(laid.height, 6);
    const [line] = textLineBoxes(pose);
    expect(line!.width).toBeCloseTo(laid.width, 6);
    // Past the fitted text's end, inside where the unfitted text would run.
    const y = pose.y + laid.height / 2;
    expect(caretIndexAt(pose.x + laid.width + 5, y, pose)).toBe(pose.text.length);
    expect(caretIndexAt(pose.x + laid.width + 5, y, { ...pose, fit: undefined })).toBeLessThan(pose.text.length);
  });

  it('settles into a pose that states the fitted sizes and lays out alike', () => {
    const pose = headline({ runs: [{ text: 'HEAD' }, { text: 'LINE', fontSize: { px: 80 } }] });
    const settled = fittedTextPose(pose);
    expect(settled.fit).toBeUndefined();
    expect(boundsOf(settled).width).toBeCloseTo(boundsOf(pose).width, 6);
    expect(settled.runs![1]!.fontSize).toEqual({ px: 80 * textFitScale(pose) });
  });

  it('leaves fitTextPose sizing the box to the text at its own size', () => {
    const pose = headline();
    expect(fitTextPose(pose, { axis: 'both' }).width).toBeCloseTo(boundsOf({ ...pose, fit: undefined }).width, 6);
  });
});
