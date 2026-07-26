import { describe, it, expect } from 'vitest';
import { buildChromeCtx } from './buildChromeCtx';
import { asNodeId } from '../../core/scene/types';
import type { ModifierState } from '../../interactions/gestures/types';
import type { View } from '../../core/viewport/view';

const MODS: ModifierState = { alt: false, ctrl: false, meta: false, shift: false };
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

describe('buildChromeCtx', () => {
  it('passes through every supplied field verbatim', () => {
    const ctx = buildChromeCtx({
      focused: true,
      selection: [asNodeId('a'), asNodeId('b')],
      multiActive: true,
      modifiers: MODS,
      action: { kind: 'marquee', id: 'pointer-mouse' },
      hover: asNodeId('a'),
      view: VIEW,
    });
    expect(ctx.focused).toBe(true);
    expect(ctx.selection).toEqual([asNodeId('a'), asNodeId('b')]);
    expect(ctx.multiActive).toBe(true);
    expect(ctx.modifiers).toBe(MODS);
    expect(ctx.action).toEqual({ kind: 'marquee', id: 'pointer-mouse' });
    expect(ctx.hover).toBe('a');
    expect(ctx.view).toBe(VIEW);
  });
});
