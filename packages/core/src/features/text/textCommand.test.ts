/**
 * Tests for `textCommand` — the plain-string convenience wrapper that
 * resolves style + wraps the input in a single run before returning a
 * `TextDrawCommand`. Verifies (1) plain-text encoding, (2) align is
 * sourced from the resolved style, (3) style defaults flow through.
 */
import { describe, it, expect } from 'vitest';
import { textCommand } from './textCommand';

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
