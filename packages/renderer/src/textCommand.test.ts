/**
 * Tests for `textCommand` — the plain-string convenience wrapper that
 * resolves style + wraps the input in a single run before returning a
 * `TextDrawCommand`. Verifies (1) plain-text encoding, (2) align is
 * sourced from the resolved style, (3) style defaults flow through.
 */
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { installFakeOffscreenCanvas, uninstallFakeOffscreenCanvas } from './patterns/test-utils/fakeOffscreenCanvas';
import { textCommand, textCommandFromPose, textCommandFromRuns, textCommandFromRunsInto } from './textCommand';
import type { TextDrawCommand } from './index';

describe('textCommand', () => {
  it('emits a `text` DrawCommand with the given position and text', () => {
    const cmd = textCommand(10, 20, 'hello');
    expect(cmd.kind).toBe('text');
    if (cmd.kind !== 'text') throw new Error('unreachable');
    expect(cmd.x).toBe(10);
    expect(cmd.y).toBe(20);
    expect(cmd.runs.length).toBeGreaterThan(0);
    expect(cmd.runs[0].text).toBe('hello');
  });

  it('align defaults to the resolved style align (`left`)', () => {
    const cmd = textCommand(0, 0, 'x');
    if (cmd.kind !== 'text') throw new Error('unreachable');
    expect(cmd.align).toBe('left');
  });

  it('explicit align flows through via style override', () => {
    const cmd = textCommand(0, 0, 'x', { align: 'right' });
    if (cmd.kind !== 'text') throw new Error('unreachable');
    expect(cmd.align).toBe('right');
  });

  it('carries justify beside the direction that sets a last line\'s edge', () => {
    const cmd = textCommand(0, 0, 'x', { align: 'justify', direction: 'rtl' });
    if (cmd.kind !== 'text') throw new Error('unreachable');
    expect(cmd.align).toBe('justify');
    expect(cmd.direction).toBe('rtl');
    expect(cmd.justify).toBe(true);
    const plain = textCommand(0, 0, 'x', { align: 'right' });
    if (plain.kind !== 'text') throw new Error('unreachable');
    expect(plain.justify).toBeFalsy();
  });

  it('carries a pose\'s justify into its command', () => {
    const cmd = textCommandFromPose({
      x: 0, y: 0, width: 100, height: 20, text: 'x', style: { align: 'justify', wrap: true },
    });
    expect(cmd.align).toBe('justify');
    expect(cmd.direction).toBe('auto');
    expect(cmd.justify).toBe(true);
  });

  it('maxWidth is forwarded as-is', () => {
    const cmd = textCommand(0, 0, 'wrap me', undefined, 80);
    if (cmd.kind !== 'text') throw new Error('unreachable');
    expect(cmd.maxWidth).toBe(80);
  });

  it('maxWidth defaults to undefined when omitted', () => {
    const cmd = textCommand(0, 0, 'x');
    if (cmd.kind !== 'text') throw new Error('unreachable');
    expect(cmd.maxWidth).toBeUndefined();
  });

  it('style passes through (empty default when undefined)', () => {
    const cmdNoStyle = textCommand(0, 0, 'x');
    if (cmdNoStyle.kind !== 'text') throw new Error('unreachable');
    expect(cmdNoStyle.style).toEqual({});
    const cmdWithStyle = textCommand(0, 0, 'x', { fontSize: 24 });
    if (cmdWithStyle.kind !== 'text') throw new Error('unreachable');
    expect(cmdWithStyle.style.fontSize).toBe(24);
  });

  it('height is forwarded as-is', () => {
    const cmd = textCommand(0, 0, 'x', undefined, undefined, 120);
    if (cmd.kind !== 'text') throw new Error('unreachable');
    expect(cmd.height).toBe(120);
  });

  it('height defaults to undefined when omitted', () => {
    const cmd = textCommand(0, 0, 'x');
    if (cmd.kind !== 'text') throw new Error('unreachable');
    expect(cmd.height).toBeUndefined();
  });

  it('verticalAlign is forwarded as-is', () => {
    const cmd = textCommand(0, 0, 'x', undefined, undefined, 120, 'center');
    if (cmd.kind !== 'text') throw new Error('unreachable');
    expect(cmd.verticalAlign).toBe('center');
  });

  it('verticalAlign defaults to undefined when omitted', () => {
    const cmd = textCommand(0, 0, 'x');
    if (cmd.kind !== 'text') throw new Error('unreachable');
    expect(cmd.verticalAlign).toBeUndefined();
  });
});

describe('screen-pixel sizes', () => {
  it('resolves a `{ px }` fontSize against the scale the builder is given', () => {
    const cmd = textCommand(0, 0, 'x', { fontSize: { px: 24 } }, undefined, undefined, undefined, undefined, undefined, 3);
    if (cmd.kind !== 'text') throw new Error('unreachable');
    expect(cmd.runs[0].fontSize).toBe(8);
  });

  it('resolves a `{ px }` letterSpacing the same way', () => {
    const cmd = textCommand(0, 0, 'x', { letterSpacing: { px: 6 } }, undefined, undefined, undefined, undefined, undefined, 2);
    if (cmd.kind !== 'text') throw new Error('unreachable');
    expect(cmd.runs[0].letterSpacing).toBe(3);
  });

  it('resolves a run-level `{ px }` fontSize through textCommandFromRuns', () => {
    const cmd = textCommandFromRuns(0, 0, [{ text: 'x', fontSize: { px: 32 } }], undefined, undefined, undefined, undefined, undefined, undefined, 4);
    if (cmd.kind !== 'text') throw new Error('unreachable');
    expect(cmd.runs[0].fontSize).toBe(8);
  });

  it('resolves a pose `{ px }` fontSize through textCommandFromPose', () => {
    const cmd = textCommandFromPose(
      { x: 0, y: 0, width: 100, height: 20, text: 'x', style: { fontSize: { px: 24 } } },
      6,
    );
    expect(cmd.runs[0].fontSize).toBe(4);
  });

  it('leaves the command carrying the authored style, unresolved', () => {
    const cmd = textCommand(0, 0, 'x', { fontSize: { px: 24 } }, undefined, undefined, undefined, undefined, undefined, 3);
    if (cmd.kind !== 'text') throw new Error('unreachable');
    expect(cmd.style.fontSize).toEqual({ px: 24 });
  });

  it('maps a bounds paint on a pose onto the pose box, stroke included', () => {
    const grad = {
      kind: 'linear-gradient' as const, from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }], units: 'bounds' as const,
    };
    const cmd = textCommandFromPose({
      x: 10, y: 20, width: 100, height: 40, text: 'x',
      fill: { paint: grad }, stroke: { paint: grad, width: 1 },
    });
    const want = { from: { x: 10, y: 20 }, to: { x: 110, y: 20 }, units: 'local' };
    expect(cmd.runs[0].fill).toMatchObject({ paint: want });
    expect(cmd.runs[0].stroke?.paint).toMatchObject(want);
  });

  it('hands solid runs through untouched', () => {
    const paint = { kind: 'solid' as const, color: '#123' };
    const cmd = textCommandFromPose({ x: 0, y: 0, width: 10, height: 10, text: 'x', fill: { paint } });
    expect(cmd.runs[0].fill?.paint).toBe(paint);
  });
});

describe('text with no pose', () => {
  beforeEach(installFakeOffscreenCanvas);
  afterEach(uninstallFakeOffscreenCanvas);
  const hatch = { kind: 'hatch' as const, color: '#000' };

  it('swaps a tile paint for its texture in textCommand', () => {
    const cmd = textCommand(0, 0, 'Hi', undefined, undefined, undefined, undefined, { fill: { paint: hatch } });
    expect((cmd as TextDrawCommand).runs[0].fill?.paint).toMatchObject({ kind: 'texture' });
  });

  it('swaps a run\'s tile fill and stroke in textCommandFromRuns and textCommandFromRunsInto', () => {
    const runs = [{ text: 'Hi', fill: { paint: hatch }, stroke: { paint: hatch, width: 1 } }];
    const cmd = textCommandFromRuns(0, 0, runs) as TextDrawCommand;
    expect(cmd.runs[0].fill?.paint).toMatchObject({ kind: 'texture' });
    expect(cmd.runs[0].stroke?.paint).toMatchObject({ kind: 'texture' });
    const again = textCommandFromRunsInto(cmd, 0, 0, runs);
    expect(again.runs[0].fill?.paint).toMatchObject({ kind: 'texture' });
    expect(runs[0].fill.paint).toBe(hatch);
  });
});

describe('a run stroke whose paint cannot resolve', () => {
  // No OffscreenCanvas here, so no tile rasterizes.
  const unresolvable = { paint: { kind: 'hatch' as const, color: '#0a0' }, width: 2 };

  it('is dropped from a pose\'s runs, as a path drops one', () => {
    const cmd = textCommandFromPose({ x: 0, y: 0, width: 10, height: 10, text: 'x', stroke: unresolvable });
    expect(cmd.runs[0].stroke).toBeUndefined();
  });

  it('is dropped from text with no pose', () => {
    const cmd = textCommandFromRuns(0, 0, [{ text: 'x', stroke: unresolvable }]) as TextDrawCommand;
    expect(cmd.runs[0].stroke).toBeUndefined();
  });
});
