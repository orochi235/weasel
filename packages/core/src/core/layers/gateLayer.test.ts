import { describe, it, expect, vi } from 'vitest';
import { gateLayer } from './gateLayer';
import type { RenderLayer } from './render';
import type { DrawCommand } from '@weasel-js/renderer';

const stubView = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const stubDims = { width: 100, height: 100, dpr: 1 };

function makeLayer(): RenderLayer<undefined> {
  const drawFn = vi.fn((): DrawCommand[] => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } }]);
  return {
    id: 'inner',
    label: 'Inner',
    draw: drawFn,
  };
}

describe('gateLayer', () => {
  it('emits the wrapped layer\'s commands when `visible()` returns true', () => {
    const inner = makeLayer();
    const visible = true;
    const gated = gateLayer({ layer: inner, visible: () => visible });
    const out = gated.draw(undefined, stubView, stubDims);
    expect(out.length).toBe(1);
    expect(inner.draw).toHaveBeenCalledTimes(1);
    void visible;
  });

  it('emits an empty array (and does not call inner draw) when `visible()` returns false', () => {
    const inner = makeLayer();
    const gated = gateLayer({ layer: inner, visible: () => false });
    const out = gated.draw(undefined, stubView, stubDims);
    expect(out).toEqual([]);
    expect(inner.draw).not.toHaveBeenCalled();
  });

  it('reads the predicate live each call (does not capture at construction time)', () => {
    const inner = makeLayer();
    let visible = false;
    const gated = gateLayer({ layer: inner, visible: () => visible });
    expect(gated.draw(undefined, stubView, stubDims)).toEqual([]);
    visible = true;
    expect(gated.draw(undefined, stubView, stubDims).length).toBe(1);
    visible = false;
    expect(gated.draw(undefined, stubView, stubDims)).toEqual([]);
  });

  it('preserves id, label, defaultVisible, alwaysOn, space from the wrapped layer', () => {
    const inner: RenderLayer<undefined> = {
      id: 'x',
      label: 'X',
      draw: () => [],
      defaultVisible: false,
      alwaysOn: true,
      space: 'screen',
    };
    const gated = gateLayer({ layer: inner, visible: () => true });
    expect(gated.id).toBe('x');
    expect(gated.label).toBe('X');
    expect(gated.defaultVisible).toBe(false);
    expect(gated.alwaysOn).toBe(true);
    expect(gated.space).toBe('screen');
  });

  it('omits optional fields not present on the inner layer', () => {
    const inner = makeLayer(); // no defaultVisible, alwaysOn, or space
    const gated = gateLayer({ layer: inner, visible: () => true });
    expect(gated.defaultVisible).toBeUndefined();
    expect(gated.alwaysOn).toBeUndefined();
    expect(gated.space).toBeUndefined();
  });

  it('carries the wrapped layer\'s effects through', () => {
    const effects = [{ kind: 'blur', radius: 4 }] as unknown as NonNullable<RenderLayer<undefined>['effects']>;
    const gated = gateLayer({ layer: { ...makeLayer(), effects }, visible: () => true });
    expect(gated.effects).toBe(effects);
  });

  it('hit-tests the wrapped layer only while it is visible', () => {
    let visible = true;
    const hit = { kind: 'handle', owner: 'inner' } as unknown as ReturnType<NonNullable<RenderLayer<undefined>['hitTest']>>;
    const gated = gateLayer({ layer: { ...makeLayer(), hitTest: () => hit }, visible: () => visible });
    expect(gated.hitTest!(0, 0, undefined, stubView, stubDims)).toBe(hit);
    visible = false;
    expect(gated.hitTest!(0, 0, undefined, stubView, stubDims)).toBeNull();
  });

  it('keys the wrapped layer\'s cache on visibility as well', () => {
    let visible = true;
    const gated = gateLayer({ layer: { ...makeLayer(), deps: () => ['a'] }, visible: () => visible });
    const shown = gated.deps!(undefined, stubView, stubDims);
    visible = false;
    const hidden = gated.deps!(undefined, stubView, stubDims);
    expect(shown).toHaveLength(hidden.length);
    expect(shown.every((d, i) => Object.is(d, hidden[i]))).toBe(false);
  });
});
