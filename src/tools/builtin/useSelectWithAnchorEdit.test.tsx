import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSelectWithAnchorEdit } from './useSelectWithAnchorEdit';
import { PathBuilder } from '../../features/paths/builder';
import type { Path, PolygonPath } from '../../features/paths/types';

interface PathObj { id: string }

function makePath(): PolygonPath {
  return new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).build();
}

function makeAdapter(initial: Path) {
  let pose: Path = initial;
  return {
    getObject: (id: string) => (id === 'p' ? { id } : undefined),
    getObjects: () => [{ id: 'p' }],
    getPose: (_id: string) => pose,
    getParent: () => null,
    setPose: (_id: string, p: Path) => { pose = p; },
    setParent: () => {},
    getSelection: () => [],
    setSelection: () => {},
    hitTestArea: () => [],
    applyOps: () => {},
  };
}

function makeDoubleClickEvent(target: HTMLElement, clientX: number, clientY: number) {
  // Minimal MouseEvent shape — the helper reads .target, .clientX, .clientY.
  return {
    target,
    clientX,
    clientY,
  } as unknown as React.MouseEvent<HTMLElement>;
}

describe('useSelectWithAnchorEdit', () => {
  it('starts with select active and editingId null', () => {
    const adapter = makeAdapter(makePath());
    const { result } = renderHook(() =>
      useSelectWithAnchorEdit<PathObj, Path>(adapter, {
        pickEvery: () => ['p'],
        boundsOf: () => ({ x: 0, y: 0, width: 100, height: 100 }),
      }),
    );
    expect(result.current.editingId).toBe(null);
    expect(result.current.tools.active).toBe('select');
    expect(result.current.tools.registry.select).toBeDefined();
    expect(result.current.tools.registry['edit-anchors']).toBeDefined();
  });

  it('double-click on a body hit flips active to edit-anchors and sets editingId', () => {
    const adapter = makeAdapter(makePath());
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const { result } = renderHook(() =>
      useSelectWithAnchorEdit<PathObj, Path>(adapter, {
        pickEvery: () => ['p'],
        boundsOf: () => ({ x: 0, y: 0, width: 100, height: 100 }),
        clientToWorld: () => [10, 10],
      }),
    );
    act(() => {
      result.current.onDoubleClick(makeDoubleClickEvent(canvas, 10, 10));
    });
    expect(result.current.editingId).toBe('p');
    expect(result.current.tools.active).toBe('edit-anchors');
    document.body.removeChild(canvas);
  });

  it('editingFilter gates which id enters edit mode', () => {
    const adapter = makeAdapter(makePath());
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const { result } = renderHook(() =>
      useSelectWithAnchorEdit<PathObj, Path>(adapter, {
        pickEvery: () => ['other', 'p'],
        boundsOf: () => null,
        editingFilter: (ids) => (ids.includes('p') ? 'p' : null),
        clientToWorld: () => [0, 0],
      }),
    );
    act(() => {
      result.current.onDoubleClick(makeDoubleClickEvent(canvas, 0, 0));
    });
    expect(result.current.editingId).toBe('p');
    document.body.removeChild(canvas);
  });

  it('editingFilter returning null keeps select active', () => {
    const adapter = makeAdapter(makePath());
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const { result } = renderHook(() =>
      useSelectWithAnchorEdit<PathObj, Path>(adapter, {
        pickEvery: () => ['nope'],
        boundsOf: () => null,
        editingFilter: () => null,
        clientToWorld: () => [0, 0],
      }),
    );
    act(() => {
      result.current.onDoubleClick(makeDoubleClickEvent(canvas, 0, 0));
    });
    expect(result.current.editingId).toBe(null);
    expect(result.current.tools.active).toBe('select');
    document.body.removeChild(canvas);
  });

  it('Escape on the edit-anchors tool clears editingId via onExit', () => {
    const adapter = makeAdapter(makePath());
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const { result } = renderHook(() =>
      useSelectWithAnchorEdit<PathObj, Path>(adapter, {
        pickEvery: () => ['p'],
        boundsOf: () => null,
        clientToWorld: () => [0, 0],
      }),
    );
    act(() => {
      result.current.onDoubleClick(makeDoubleClickEvent(canvas, 0, 0));
    });
    expect(result.current.editingId).toBe('p');

    // Drive the keyboard.onDown(Escape) handler on the edit-anchors tool.
    const editTool = result.current.tools.registry['edit-anchors'];
    const scratch = editTool.initScratch!();
    const ke = new Event('keydown') as KeyboardEvent;
    Object.assign(ke, { key: 'Escape' });
    act(() => {
      editTool.keyboard!.onDown!(ke, {
        worldX: 0,
        worldY: 0,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
        selection: { current: [], applyClick: () => {} } as never,
        adapter: {},
        applyBatch: () => {},
        view: { x: 0, y: 0, scale: 1 },
        setView: () => {},
        canvasRect: new DOMRect(),
        scratch,
      });
    });
    expect(result.current.editingId).toBe(null);
    expect(result.current.tools.active).toBe('select');
    document.body.removeChild(canvas);
  });
});
