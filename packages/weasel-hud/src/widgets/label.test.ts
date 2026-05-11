import { describe, it, expect } from 'vitest';
import { createLabel } from './label';
import { readTokens } from '../theme';

const DEFAULT_RESOLVED_TOKENS = readTokens(null);

describe('label widget', () => {
  it('uses sensible defaults for fontSize when omitted', () => {
    const l = createLabel({ id: 'l', x: 0, y: 0, text: 'x' });
    const cmds = l.draw({ dims: { width: 100, height: 100 }, defaultFont: 'Default', tokens: DEFAULT_RESOLVED_TOKENS });
    expect((cmds[0] as { style: { fontSize: number } }).style.fontSize).toBe(13);
  });

  it('uses ctx.defaultFont when no fontFamily is supplied (label never passes one)', () => {
    const l = createLabel({ id: 'l', x: 0, y: 0, text: 'x' });
    const cmds = l.draw({ dims: { width: 100, height: 100 }, defaultFont: 'Default', tokens: DEFAULT_RESOLVED_TOKENS });
    expect((cmds[0] as { style: { fontFamily: string } }).style.fontFamily).toBe('Default');
  });

  it('respects overrides when provided', () => {
    const l = createLabel({ id: 'l', x: 0, y: 0, text: 'x', fontSize: 20 });
    const cmds = l.draw({ dims: { width: 100, height: 100 }, defaultFont: 'D', tokens: DEFAULT_RESOLVED_TOKENS });
    expect((cmds[0] as { style: { fontSize: number } }).style.fontSize).toBe(20);
  });
});
