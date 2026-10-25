import { afterEach, describe, expect, it, vi } from 'vitest';
import { boundsOfPath, rectPath } from '@weasel-js/core';
import { boxForContent, contentBox, outlineDetail, outlinePath, type Bounds } from '../outline';
import { outlineFromD, registerOutline } from './table';

const BOX: Bounds = { x: 10, y: 20, width: 100, height: 40 };

afterEach(() => vi.restoreAllMocks());

describe('registerOutline', () => {
  it('resolves a registered name through outlinePath, contentBox, and boxForContent', () => {
    const dispose = registerOutline('test:inset', {
      path: (b) => rectPath(b.x, b.y, b.width, b.height),
      content: (b) => ({ x: b.x + 5, y: b.y + 5, width: b.width - 10, height: b.height - 10 }),
      boxForContent: (c) => ({ width: c.width + 10, height: c.height + 10 }),
    });
    expect(outlinePath('test:inset', BOX)).toEqual(rectPath(10, 20, 100, 40));
    expect(contentBox('test:inset', BOX)).toEqual({ x: 15, y: 25, width: 90, height: 30 });
    expect(boxForContent('test:inset', { width: 20, height: 10 })).toEqual({ width: 30, height: 20 });
    dispose();
  });

  it('defaults content to the bounds and boxForContent to the content size', () => {
    const dispose = registerOutline('test:bare', { path: (b) => rectPath(b.x, b.y, b.width, b.height) });
    expect(contentBox('test:bare', BOX)).toEqual(BOX);
    expect(boxForContent('test:bare', { width: 7, height: 3 })).toEqual({ width: 7, height: 3 });
    dispose();
  });

  it('restores the definition it shadowed when disposed', () => {
    const before = outlinePath('diamond', BOX);
    const dispose = registerOutline('diamond', { path: (b) => rectPath(b.x, b.y, b.width, b.height) });
    expect(outlinePath('diamond', BOX)).toEqual(rectPath(10, 20, 100, 40));
    dispose();
    expect(outlinePath('diamond', BOX)).toEqual(before);
  });
});

describe('an unregistered name', () => {
  it('paints as a rect and warns once per name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(outlinePath('test:nowhere', BOX)).toEqual(rectPath(10, 20, 100, 40));
    expect(contentBox('test:nowhere', BOX)).toEqual(BOX);
    outlinePath('test:nowhere', BOX);
    expect(warn).toHaveBeenCalledTimes(1);
    outlinePath('test:elsewhere', BOX);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('outlineDetail', () => {
  it('is null for an outline with no detail, and for a custom path', () => {
    expect(outlineDetail('rect', BOX)).toBeNull();
    expect(outlineDetail(rectPath(0, 0, 1, 1), BOX)).toBeNull();
  });

  it('builds a registered detail in the bounds', () => {
    const dispose = registerOutline('test:detail', {
      path: (b) => rectPath(b.x, b.y, b.width, b.height),
      detail: (b) => rectPath(b.x + 1, b.y + 1, 2, 2),
    });
    expect(outlineDetail('test:detail', BOX)).toEqual(rectPath(11, 21, 2, 2));
    expect(outlineDetail('test:detail', { ...BOX, width: 0 })).toBeNull();
    dispose();
  });
});

describe('outlineFromD', () => {
  const def = outlineFromD('M0.5 0 L1 1 L0 1 Z', {
    detail: 'M0 0.5 L1 0.5',
    content: { x: 0.25, y: 0.5, width: 0.5, height: 0.5 },
  });

  it('stretches unit-square path data over the bounds', () => {
    const b = boundsOfPath(def.path(BOX));
    expect(b).toMatchObject({ x: 10, y: 20, width: 100, height: 40 });
    const d = boundsOfPath(def.detail!(BOX));
    expect(d.y).toBeCloseTo(40);
    expect(d.width).toBeCloseTo(100);
  });

  it('maps its unit content box into the bounds, and inverts it', () => {
    expect(def.content!(BOX)).toEqual({ x: 35, y: 40, width: 50, height: 20 });
    expect(def.boxForContent!({ width: 50, height: 20 })).toEqual({ width: 100, height: 40 });
  });

  it('defaults content to the whole bounds', () => {
    const plain = outlineFromD('M0 0 L1 0 L1 1 Z');
    expect(plain.content!(BOX)).toEqual(BOX);
    expect(plain.detail).toBeUndefined();
  });
});
