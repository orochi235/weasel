import { describe, expect, it } from 'vitest';
import { allocators, frameName, type HeapProfileNode } from './heapProfile.ts';

let id = 0;
const n = (functionName: string, selfSize: number, children: HeapProfileNode[] = [], url = ''): HeapProfileNode =>
  ({ callFrame: { functionName, url, lineNumber: 9 }, selfSize, id: id++, children });

describe('allocators', () => {
  it('sums self bytes per function and counts a recursive function once in its total', () => {
    const head = n('(root)', 0, [
      n('draw', 10, [n('layout', 100, [n('layout', 50)]), n('push', 5)]),
      n('step', 0, [n('layout', 7)]),
    ]);
    const { all, rows } = allocators({ head });
    const by = Object.fromEntries(rows.map((r) => [r.fn, r]));
    expect(all).toBe(172);
    expect(by.layout).toEqual({ fn: 'layout', self: 157, total: 157 });
    expect(by.draw).toMatchObject({ self: 10, total: 165 });
    expect(by.step).toMatchObject({ self: 0, total: 7 });
    expect(by['(root)'].total).toBe(172);
    expect(rows[0].fn).toBe('layout');
  });
});

describe('frameName', () => {
  it('cuts a dev-server url to the repo path and makes the line 1-based', () => {
    expect(frameName({ functionName: 'drawText', url: 'http://localhost:1/weasel/@fs/Users/x/weasel/packages/renderer/src/draw/text.ts?t=1', lineNumber: 56 }))
      .toBe('drawText (packages/renderer/src/draw/text.ts:57)');
    expect(frameName({ functionName: '', url: '', lineNumber: 0 })).toBe('(anonymous)');
  });
});
