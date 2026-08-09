import { describe, it, expect } from 'vitest';
import { createLabel } from './label';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';

const DEFAULT_RESOLVED_TOKENS = resolveTheme(weaselTheme, 'dark');

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

  it('uses ctx.tokens.--wzl-fg when color is omitted', () => {
    const l = createLabel({ id: 'l', x: 0, y: 0, text: 'x' });
    const customTokens = { ...DEFAULT_RESOLVED_TOKENS, '--wzl-fg': '#abcdef' };
    const cmds = l.draw({
      dims: { width: 100, height: 100 },
      defaultFont: 'Default',
      tokens: customTokens,
    });
    const fill = (cmds[0] as { style: { fill: { color: string } } }).style.fill;
    expect(fill.color).toBe('#abcdef');
  });

  it('respects explicit color when supplied (theme overridden)', () => {
    const l = createLabel({ id: 'l', x: 0, y: 0, text: 'x', color: '#ff0000' });
    const customTokens = { ...DEFAULT_RESOLVED_TOKENS, '--wzl-fg': '#abcdef' };
    const cmds = l.draw({
      dims: { width: 100, height: 100 },
      defaultFont: 'D',
      tokens: customTokens,
    });
    const fill = (cmds[0] as { style: { fill: { color: string } } }).style.fill;
    expect(fill.color).toBe('#ff0000');
  });
});
