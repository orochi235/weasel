import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClipboardOps } from './clipboardOps';
import { clipboardPasteAction } from './action';
import type { InsertAdapter } from '../../..';
import type { ActionDeps } from '@weasel-js/routing';
import { asNodeId } from 'core/scene/types';
import { rootsTree } from 'core/adapters/testing/rootsTree';

interface Obj { id: string; x: number; y: number }
type Pt = { x: number; y: number };
type Run = (deps: ActionDeps, params?: Record<string, unknown>) => void;

function setup(getDropPoint?: () => Pt | null) {
  const pool: Obj[] = [{ id: 'a', x: 0, y: 0 }];
  const dropPoints: (Pt | undefined)[] = [];
  const adapter: InsertAdapter<Obj> = {
    ...rootsTree<Obj>(),
    commitInsert: () => null,
    commitPaste(clipboard, _offset, ctx) {
      dropPoints.push(ctx?.dropPoint);
      return clipboard.items.map((_, i) => ({ id: `n${dropPoints.length}-${i}`, x: 0, y: 0 }));
    },
    snapshotSelection: (ids) => ({ items: pool.filter((p) => ids.includes(p.id)) }),
    getPasteOffset: () => ({ dx: 1, dy: 1 }),
    insertNode: (o) => { pool.push(o); },
    setSelection: () => {},
    getSelection: () => [],
    applyOps: (ops) => { for (const op of ops) op.apply(adapter as never); },
  };
  const { result } = renderHook(() =>
    useClipboardOps(adapter, { getSelection: () => [asNodeId('a')], getDropPoint }),
  );
  act(() => { result.current.copy(); });
  return { clipboard: result.current, dropPoints };
}

const run = (clipboardPasteAction.invoker as unknown as { run: Run }).run;

describe('paste at a point', () => {
  const at = { x: 300, y: 400 };
  const hover = () => ({ x: 1, y: 2 });

  it('paste(at) hands the point to commitPaste, ignoring getDropPoint', () => {
    const { clipboard, dropPoints } = setup(hover);
    act(() => { clipboard.paste(at); });
    expect(dropPoints).toEqual([at]);
  });

  it('paste() still reads getDropPoint', () => {
    const { clipboard, dropPoints } = setup(hover);
    act(() => { clipboard.paste(); });
    expect(dropPoints).toEqual([{ x: 1, y: 2 }]);
  });

  it('clipboard.paste forwards its `world` param', () => {
    const { clipboard, dropPoints } = setup(hover);
    act(() => { run({ clipboard } as unknown as ActionDeps, { world: { x: at.x, y: at.y } }); });
    expect(dropPoints).toEqual([at]);
  });

  it('clipboard.paste without params falls back to getDropPoint', () => {
    const { clipboard, dropPoints } = setup(hover);
    act(() => { run({ clipboard } as unknown as ActionDeps, {}); });
    expect(dropPoints).toEqual([{ x: 1, y: 2 }]);
  });
});
