import { describe, it, expect, vi } from 'vitest';
import { createText } from './text';
import type { TextDrawCommand } from '@weasel-js/core/renderer';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';

const DEFAULT_RESOLVED_TOKENS = resolveTheme(weaselTheme, 'dark');
const ctx = { dims: { width: 100, height: 100 }, defaultFont: 'Default', tokens: DEFAULT_RESOLVED_TOKENS };

describe('text widget', () => {
  it('emits a TextDrawCommand using the supplied style', () => {
    const t = createText({ id: 't', x: 0, y: 10, text: 'hi', fontSize: 14, color: '#000', fontFamily: 'Foo' });
    const cmds = t.draw(ctx);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({ kind: 'text', runs: [{ text: 'hi' }], x: 0, y: 10 });
    expect((cmds[0] as { style: { fontFamily: string } }).style.fontFamily).toBe('Foo');
  });

  it('falls back to ctx.defaultFont when no fontFamily is given', () => {
    const t = createText({ id: 't', x: 0, y: 10, text: 'hi', fontSize: 14, color: '#000' });
    const cmds = t.draw(ctx);
    expect((cmds[0] as { style: { fontFamily: string } }).style.fontFamily).toBe('Default');
  });

  it('setText mutates and the next draw reflects it', () => {
    const t = createText({ id: 't', x: 0, y: 10, text: 'a', fontSize: 14, color: '#000' });
    t.setText('b');
    const cmds = t.draw(ctx);
    expect((cmds[0] as { runs: Array<{ text: string }> }).runs[0].text).toBe('b');
  });

  it('onChange fires when state mutates', () => {
    const onChange = vi.fn();
    const t = createText({ id: 't', x: 0, y: 0, text: 'x', fontSize: 13, color: '#000', onChange });
    onChange.mockClear();
    t.setText('y');
    t.setHidden(true);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('hitTest always returns false (text is passive)', () => {
    const t = createText({ id: 't', x: 0, y: 0, text: 'x', fontSize: 13, color: '#000' });
    expect(t.hitTest(0, 0)).toBe(false);
  });

  it('uses ctx.tokens.--wzl-fg when opts.color is omitted', () => {
    const t = createText({ id: 't', x: 0, y: 10, text: 'hi', fontSize: 14 });
    const customCtx = {
      ...ctx,
      tokens: { ...ctx.tokens, '--wzl-fg': '#facade' },
    };
    const cmds = t.draw(customCtx);
    const fill = (cmds[0] as TextDrawCommand).runs[0].fill;
    expect(fill).toEqual({ fill: 'solid', color: '#facade' });
  });

  it('respects explicit opts.color over theme', () => {
    const t = createText({ id: 't', x: 0, y: 10, text: 'hi', fontSize: 14, color: '#ff0000' });
    const customCtx = {
      ...ctx,
      tokens: { ...ctx.tokens, '--wzl-fg': '#facade' },
    };
    const cmds = t.draw(customCtx);
    const fill = (cmds[0] as TextDrawCommand).runs[0].fill;
    expect(fill).toEqual({ fill: 'solid', color: '#ff0000' });
  });
});
