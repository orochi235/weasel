import { describe, expect, it, vi } from 'vitest';
import type { PathDrawCommand } from '@weasel-js/renderer';
import type { EnteredGroupDep } from 'canvas/deps/enteredGroup';
import { createEnteredGroupFrameLayer } from './enteredGroupFrame';

const DIMS = { width: 200, height: 200 };
const VIEW = { x: 10, y: 20, scale: { x: 2, y: 2 } };

function entered(id: string | null): EnteredGroupDep {
  return { get: () => id as never, enter: () => {}, leave: () => {}, subscribe: () => () => {} };
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
});
