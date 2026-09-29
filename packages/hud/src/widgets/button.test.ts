import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createButton } from './button';
import { layoutRuns, resolveTextStyle, verticalAlignOffset } from '@weasel-js/text';
import { registerDefaultFont, DEFAULT_FONT_FAMILY } from '../fonts/registerDefaultFont';
import { resolveFontVariant } from '@weasel-js/font';
import type { TextDrawCommand } from '@weasel-js/core/renderer';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';

const DEFAULT_RESOLVED_TOKENS = resolveTheme(weaselTheme, { mode: 'dark' });
const ctx = { dims: { width: 100, height: 100 }, defaultFont: 'D', toneAt: () => '#000000', tokens: DEFAULT_RESOLVED_TOKENS };

describe('button widget', () => {
  it('draws a body rect and a label', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'Save' });
    const cmds = b.draw(ctx);
    expect(cmds.length).toBeGreaterThanOrEqual(2);   // body + text
    expect(cmds.some(c => c.kind === 'path')).toBe(true);
    expect(cmds.some(c => c.kind === 'text')).toBe(true);
  });

  it('hitTest is bounds-rectangular', () => {
    const b = createButton({ id: 'b', x: 10, y: 10, w: 80, h: 24, label: 'x' });
    expect(b.hitTest(20, 20)).toBe(true);
    expect(b.hitTest(0, 0)).toBe(false);
  });

  it('answers a pointer cursor inside its bounds', () => {
    const b = createButton({ id: 'b', x: 10, y: 10, w: 80, h: 24, label: 'x' });
    expect(b.cursorAt!(20, 20)).toBe('pointer');
  });

  it('takes a cursor override', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x', cursor: 'help' });
    expect(b.cursorAt!(5, 5)).toBe('help');
  });

  it('answers the default cursor while hidden', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    b.setHidden(true);
    expect(b.cursorAt!(5, 5)).toBe('default');
  });

  it('press event fires on down then up inside bounds', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const press = vi.fn();
    b.on('press', press);

    b.onPointer({ type: 'down', x: 5, y: 5, native: null });
    b.onPointer({ type: 'up', x: 5, y: 5, native: null });
    expect(press).toHaveBeenCalledTimes(1);
  });

  it('onChange fires when state mutates (used by Hud to trigger redraws)', () => {
    const onChange = vi.fn();
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x', onChange });
    onChange.mockClear();
    b.setLabel('y');
    expect(onChange).toHaveBeenCalled();
  });

  it('press event does NOT fire on down then up-outside', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const press = vi.fn();
    b.on('press', press);

    b.onPointer({ type: 'down', x: 5, y: 5, native: null });
    b.onPointer({ type: 'up', x: 200, y: 200, native: null });
    expect(press).not.toHaveBeenCalled();
  });

  it('cancel rolls back press state without firing press', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const press = vi.fn();
    b.on('press', press);

    b.onPointer({ type: 'down', x: 5, y: 5, native: null });
    b.onPointer({ type: 'cancel', native: null });
    expect(press).not.toHaveBeenCalled();
  });

  it('setLabel mutates the rendered text', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'a' });
    b.setLabel('b');
    const cmds = b.draw(ctx);
    const txt = cmds.find(c => c.kind === 'text') as { runs: Array<{ text: string }> };
    expect(txt.runs[0].text).toBe('b');
  });

  it('off() removes a handler', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const press = vi.fn();
    b.on('press', press);
    b.off('press', press);
    b.onPointer({ type: 'down', x: 5, y: 5, native: null });
    b.onPointer({ type: 'up', x: 5, y: 5, native: null });
    expect(press).not.toHaveBeenCalled();
  });

  it('throws on setter after dispose', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    b.dispose();
    expect(() => b.setLabel('y')).toThrow();
    expect(() => b.setBounds({ x: 0, y: 0, w: 10, h: 10 })).toThrow();
    expect(() => b.setHidden(true)).toThrow();
    expect(() => b.on('press', () => {})).toThrow();
    expect(() => b.off('press', () => {})).toThrow();
  });

  it('dispose() is idempotent — calling twice does not throw', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    b.dispose();
    expect(() => b.dispose()).not.toThrow();
  });

  it('dispose() calls removeFromHud', () => {
    const removeFromHud = vi.fn();
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x', removeFromHud });
    b.dispose();
    expect(removeFromHud).toHaveBeenCalledTimes(1);
    // second dispose should not call it again
    b.dispose();
    expect(removeFromHud).toHaveBeenCalledTimes(1);
  });

  it('hover event fires on hovermove transition', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const hover = vi.fn();
    const leave = vi.fn();
    b.on('hover', hover);
    b.on('leave', leave);

    b.onPointer({ type: 'hovermove', x: 5, y: 5, native: null });
    expect(hover).toHaveBeenCalledTimes(1);
    b.onPointer({ type: 'hovermove', x: 6, y: 6, native: null });
    expect(hover).toHaveBeenCalledTimes(1);  // no re-fire while hovering
    b.onPointer({ type: 'hoverleave', native: null });
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('uses ctx.tokens.--wzl-surface-raised when opts.fill is omitted', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const customCtx = { ...ctx, tokens: { ...ctx.tokens, '--wzl-surface-raised': '#abcdef' } };
    const cmds = b.draw(customCtx);
    const body = cmds.find(c => c.kind === 'path') as { fill: { color: string } };
    expect(body.fill.color).toBe('#abcdef');
  });

  it('respects opts.fill when supplied (theme overridden)', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x', fill: '#ff0000' });
    const customCtx = { ...ctx, tokens: { ...ctx.tokens, '--wzl-surface-raised': '#abcdef' } };
    const cmds = b.draw(customCtx);
    const body = cmds.find(c => c.kind === 'path') as { fill: { color: string } };
    expect(body.fill.color).toBe('#ff0000');
  });

  it('uses ctx.tokens.--wzl-surface-hover when hovering and opts.hoverFill is omitted', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    b.onPointer({ type: 'hovermove', x: 5, y: 5, native: null });
    const customCtx = { ...ctx, tokens: { ...ctx.tokens, '--wzl-surface-hover': '#cafe00' } };
    const cmds = b.draw(customCtx);
    const body = cmds.find(c => c.kind === 'path') as { fill: { color: string } };
    expect(body.fill.color).toBe('#cafe00');
  });

  it('uses ctx.tokens.--wzl-surface-pressed when pressed and opts.pressedFill is omitted', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    b.onPointer({ type: 'down', x: 5, y: 5, native: null });
    const customCtx = { ...ctx, tokens: { ...ctx.tokens, '--wzl-surface-pressed': '#beadc0' } };
    const cmds = b.draw(customCtx);
    const body = cmds.find(c => c.kind === 'path') as { fill: { color: string } };
    expect(body.fill.color).toBe('#beadc0');
  });

  it('uses ctx.tokens.--wzl-fg when opts.textColor is omitted', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const customCtx = { ...ctx, tokens: { ...ctx.tokens, '--wzl-fg': '#decade' } };
    const cmds = b.draw(customCtx);
    const text = cmds.find(c => c.kind === 'text') as TextDrawCommand;
    expect(text.runs[0].fill).toEqual({ fill: 'solid', color: '#decade' });
  });
});

describe('button label placement', () => {
  beforeAll(async () => {
    const interJson = await import('../fonts/inter.json');
    const fakePng = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    global.fetch = vi.fn(async (url: string) => {
      if (url.endsWith('.json')) return new Response(JSON.stringify(interJson.default ?? interJson));
      if (url.endsWith('.png')) return new Response(fakePng);
      throw new Error('unexpected url ' + url);
    }) as never;
    global.createImageBitmap = vi.fn().mockResolvedValue(
      { width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap,
    );
    const landed = registerDefaultFont();
    resolveFontVariant(DEFAULT_FONT_FAMILY, 400, 'normal');
    await landed;
  });

  // Where the renderer puts the line box (draw.ts drawText): the layout from
  // the command's origin, shifted by the verticalAlign slack.
  const lineBoxCenter = (cmd: TextDrawCommand): number => {
    const style = resolveTextStyle(cmd.style);
    const laid = layoutRuns(cmd.runs, {
      maxWidth: cmd.maxWidth ?? Infinity, lineHeight: style.lineHeight, align: cmd.align ?? style.align,
    });
    const line = laid.lines[0]!;
    const dy = cmd.y + verticalAlignOffset(cmd.verticalAlign, cmd.height, laid.bounds.height);
    return dy + (line.y0 + line.y1) / 2;
  };

  it.each([
    { y: 0, h: 24, fontSize: 13 },
    { y: 40, h: 32, fontSize: 18 },
  ])('centers the line box in a $h px button at $fontSize px', ({ y, h, fontSize }) => {
    const b = createButton({ id: 'b', x: 0, y, w: 120, h, label: 'Shape', fontSize });
    const text = b.draw({ ...ctx, defaultFont: DEFAULT_FONT_FAMILY })
      .find((c): c is TextDrawCommand => c.kind === 'text')!;
    expect(Math.abs(lineBoxCenter(text) - (y + h / 2))).toBeLessThanOrEqual(1);
  });
});

describe('button keyboard', () => {
  const k = (key: string, type: 'keydown' | 'keyup' = 'keydown') => ({
    type, key, code: '', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    repeat: false, native: null,
  });

  it('is focusable by default, and named by its label', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'Save' });
    expect(b.focusable).toBe(true);
    expect(b.accessibleName).toBe('Save');
    b.setLabel('Saved');
    expect(b.accessibleName).toBe('Saved');
  });

  it('opts out with focusable: false and takes a tab order', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x', focusable: false, tabOrder: 3 });
    expect(b.focusable).toBe(false);
    expect(b.tabOrder).toBe(3);
  });

  it('Enter and Space press it, and say so', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const press = vi.fn();
    b.on('press', press);
    expect(b.onKey!(k('Enter'))).toBe(true);
    expect(b.onKey!(k(' '))).toBe(true);
    expect(press).toHaveBeenCalledTimes(2);
  });

  it('leaves every other key for the canvas', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const press = vi.fn();
    b.on('press', press);
    expect(b.onKey!(k('Delete'))).toBe(false);
    expect(b.onKey!(k('Enter', 'keyup'))).toBe(false);
    expect(press).not.toHaveBeenCalled();
  });
});
