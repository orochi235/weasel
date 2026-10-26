import { describe, expect, it, vi } from 'vitest';
import type { PathDrawCommand } from '@weasel-js/renderer';
import type { EnteredGroupApi } from 'canvas/deps/enteredGroup';
import { createEnteredGroupFrameLayer, ENTERED_FRAME_COLOR } from './enteredGroupFrame';

const DIMS = { width: 200, height: 200, dpr: 1 };
const VIEW = { x: 10, y: 20, scale: { x: 2, y: 2 } };

function entered(id: string | null): EnteredGroupApi {
  return { get: () => id as never, enter: () => {}, leave: () => {}, leaveAll: () => {}, subscribe: () => () => {} };
}

describe('createEnteredGroupFrameLayer', () => {
  it('draws nothing while no group is entered', () => {
    const layer = createEnteredGroupFrameLayer({ entered: entered(null), boundsOf: () => ({ x: 0, y: 0, width: 5, height: 5 }) });
    expect(layer.draw({}, VIEW, DIMS)).toEqual([]);
  });

  it('draws nothing when the entered group has no box', () => {
    const layer = createEnteredGroupFrameLayer({ entered: entered('g'), boundsOf: () => null });
    expect(layer.draw({}, VIEW, DIMS)).toEqual([]);
  });

  it('frames the entered group box with one dashed outline, in screen space', () => {
    const layer = createEnteredGroupFrameLayer({
      entered: entered('g'), boundsOf: (id) => (id === 'g' ? { x: 5, y: 5, width: 10, height: 10 } : null),
    });
    const cmds = layer.draw({}, VIEW, DIMS) as PathDrawCommand[];
    expect(layer.space).toBe('screen');
    expect(cmds).toHaveLength(1);
    expect(cmds[0]!.stroke?.dash?.length).toBeGreaterThan(0);
    expect(cmds[0]!.fill).toBeUndefined();
    expect(cmds[0]!.path).toMatchObject({ kind: 'rect', x: -10, y: -30, width: 20, height: 20 });
  });

  it('repaints when the entered group changes', () => {
    const subscribe = vi.fn(() => () => {});
    const layer = createEnteredGroupFrameLayer({
      entered: { ...entered('g'), subscribe }, boundsOf: () => null,
    });
    const repaint = () => {};
    layer.subscribe?.(repaint);
    expect(subscribe).toHaveBeenCalledWith(repaint);
  });

  it('strokes in the color it reads at paint time, and in the fallback without one', () => {
    let color = '#123456';
    const boundsOf = () => ({ x: 0, y: 0, width: 5, height: 5 });
    const themed = createEnteredGroupFrameLayer({ entered: entered('g'), boundsOf, color: () => color });
    const paintOf = (cmds: unknown) => (cmds as PathDrawCommand[])[0]!.stroke?.paint;
    expect(paintOf(themed.draw({}, VIEW, DIMS))).toEqual({ kind: 'solid', color: '#123456' });
    color = '#abcdef';
    expect(paintOf(themed.draw({}, VIEW, DIMS))).toEqual({ kind: 'solid', color: '#abcdef' });
    const bare = createEnteredGroupFrameLayer({ entered: entered('g'), boundsOf });
    expect(paintOf(bare.draw({}, VIEW, DIMS))).toEqual({ kind: 'solid', color: ENTERED_FRAME_COLOR });
  });

  it('repaints when its color may have changed, as well as when the group does', () => {
    const offColor = vi.fn();
    const colorChanged = vi.fn(() => offColor);
    const layer = createEnteredGroupFrameLayer({ entered: entered('g'), boundsOf: () => null, colorChanged });
    const repaint = () => {};
    const off = layer.subscribe!(repaint);
    expect(colorChanged).toHaveBeenCalledWith(repaint);
    off();
    expect(offColor).toHaveBeenCalled();
  });
});
