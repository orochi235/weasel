import { describe, it, expect, vi } from 'vitest';
import { createButton } from './button';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';

const DEFAULT_RESOLVED_TOKENS = resolveTheme(weaselTheme, 'dark');
const ctx = { dims: { width: 100, height: 100 }, defaultFont: 'D', tokens: DEFAULT_RESOLVED_TOKENS };

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
    const text = cmds.find(c => c.kind === 'text') as { style: { fill: { color: string } } };
    expect(text.style.fill.color).toBe('#decade');
  });
});
