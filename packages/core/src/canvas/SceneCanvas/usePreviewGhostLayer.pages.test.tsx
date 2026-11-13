/** A page's child mid-drag: drawn by the ghost layer where the drag shows it, cut by no page's clip. */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import type { BindingOptions, Dispatcher, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { ON_PAGE, pagedScene } from 'core/pages/pagedFixture';
import type { Node, RectPose } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { moveAction } from 'interactions/actions/move/action';
import { usePreviewGhostLayer } from './usePreviewGhostLayer';

const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

const drawOne = (_n: Node<object, 'paper' | 'ink', RectPose>, pose: RectPose): DrawCommand[] => [{
  kind: 'path', path: { kind: 'rect', ...pose }, fill: { paint: { color: '#000' } },
}];

/** Each rect drawn, with whether a group above it clips. */
function rects(cmds: readonly DrawCommand[]): Array<{ x: number; clipped: boolean }> {
  const out: Array<{ x: number; clipped: boolean }> = [];
  const visit = (cmd: DrawCommand, clipped: boolean) => {
    if (cmd.kind === 'group') {
      const g = cmd as GroupDrawCommand;
      for (const child of g.children) visit(child, clipped || g.clip !== undefined);
    } else if (cmd.kind === 'path' && cmd.path.kind === 'rect') out.push({ x: cmd.path.x, clipped });
  };
  for (const c of cmds) visit(c, false);
  return out;
}

describe('a page\'s child mid-drag', () => {
  it('is hidden from the scene and drawn as a ghost at its dragged place, unclipped by its page', () => {
    const { scene } = pagedScene();
    const base = { world: { x: 95, y: 15 }, modifiers: MODS, deps: { selection: { get: () => [ON_PAGE] }, scene } };
    const invoker = moveAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle: OngoingHandle = invoker.start(base as unknown as InvocationCtx, {} as BindingOptions);
    const to = { x: 135, y: 15 };
    handle.onMove!({ ...base, world: to, drag: { start: base.world, current: to, delta: { x: 40, y: 0 } } } as unknown as InvocationCtx);

    expect([...(handle.previewIds?.() ?? [])]).toContain(ON_PAGE);
    expect(handle.previewHidesSource).not.toBe(false);
    const dispatcher = { subscribe: () => () => {} } as unknown as Dispatcher;
    const { result } = renderHook(() => usePreviewGhostLayer({ scene, sceneSlot: { drawOne }, dispatcher }));
    const drawn = result.current.draw({ getPreviewSources: () => [handle] }, VIEW, { width: 800, height: 600, dpr: 1 });
    // World x 130, on page b, where page a's clip (0..100) would cut it away entirely.
    expect(rects(drawn)).toEqual([{ x: 130, clipped: false }]);
    handle.onEnd!({ ...base, world: to } as unknown as InvocationCtx, 'cancel');
  });
});
