import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_FONT, registerFont } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import type { OpenMenu } from '@weasel-js/core';
import type { HudDrawCtx } from '../widget';
import { measureLabel } from './measureLabel';
import { createMenuWidget } from './menuWidget';

const FAMILY = 'Fixture Face';
const A = FIXTURE_FONT.chars[0]!.xadvance;
const B = FIXTURE_FONT.chars[1]!.xadvance;
const AB_KERN = FIXTURE_FONT.kernings[0]!.amount;
const SIZE = FIXTURE_FONT.info.size;

const realFetch = global.fetch;
const realBitmap = global.createImageBitmap;

beforeEach(async () => {
  _resetFontRegistryForTests();
  global.fetch = vi.fn(async (url: string) => (url.endsWith('.json')
    ? { ok: true, json: async () => FIXTURE_FONT }
    : { ok: true, blob: async () => new Blob(['PNG'], { type: 'image/png' }) })) as never;
  global.createImageBitmap = vi.fn(async () => ({ width: 512, height: 512, close() {} })) as never;
  await registerFont(FAMILY, {}, '/fixture.json', '/fixture.png');
});
afterEach(() => {
  _resetFontRegistryForTests();
  global.fetch = realFetch;
  global.createImageBitmap = realBitmap;
});

describe('measureLabel', () => {
  // Kerning is part of the sum because layout applies it: A→B is the fixture's one pair.
  it('sums the atlas advances, and kerning, scaled from the atlas size', () => {
    expect(measureLabel('AAB', 13, FAMILY)).toBeCloseTo((A + A + B + AB_KERN) * 13 / SIZE, 6);
    expect(measureLabel('BA', 20, FAMILY)).toBeCloseTo((B + A) * 20 / SIZE, 6);
  });
});

describe('a menu widget with no measure of its own', () => {
  const ctx = {
    dims: { width: 800, height: 600 }, defaultFont: FAMILY,
    tokens: { '--wzl-surface-popover': '#222', '--wzl-surface-hover': '#333', '--wzl-fg': '#eee', '--wzl-fg-muted': '#888', '--wzl-border': '#444', '--wzl-shadow': '#0008' },
    color: () => undefined,
  } as never as HudDrawCtx;

  it('measures in no guessed family before the hud has drawn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createMenuWidget({
      open: { seq: 1, source: 'pointer', client: { x: 10, y: 10 }, entries: [{ kind: 'item', key: 'a', label: 'A', run: () => {} }] },
      close: () => {}, toCanvas: (p) => p, canvasSize: () => ({ width: 800, height: 600 }), onChange: () => {},
    });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('sizes its panel from the family the hud draws in', () => {
    const label = 'A'.repeat(20);
    const open: OpenMenu = {
      seq: 1, source: 'pointer', client: { x: 10, y: 10 },
      entries: [{ kind: 'item', key: 'a', label, run: () => {} }],
    };
    const w = createMenuWidget({
      open, close: () => {}, toCanvas: (p) => p, canvasSize: () => ({ width: 800, height: 600 }), onChange: () => {},
    });
    w.draw(ctx);
    // padX 8 on each side plus the icon and caret columns, one row height each.
    expect(w.bounds.w).toBe(Math.ceil(20 * A * 13 / SIZE) + 16 + 48);
  });
});
