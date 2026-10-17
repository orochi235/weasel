/**
 * A committed render repaints: a bare `<Canvas>` consumer changing selection
 * gets a repaint without a wrapper calling `requestRedraw()`, and however many
 * renders land before the frame, it paints once.
 *
 * The GL recorder is load-bearing: without a `getContext('webgl2')` that
 * answers like WebGL2, every paint bails early and every assertion here
 * passes vacuously.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useMemo, useState } from 'react';
import { Canvas } from './testing/BareCanvas';
import type { SelectionApi } from '../core/selection/useSelection';
import { asNodeId, type NodeId } from '../core/scene/types';
import type { RenderLayer } from '../core/layers/render';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
  };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

afterEach(() => { cleanup(); });

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

// No `deps`, so the command cache can't serve it: one call per paint.
function probeLayer(draw: () => void): RenderLayer<unknown> {
  return {
    id: 'probe',
    label: 'Probe',
    space: 'screen',
    draw: () => {
      draw();
      return [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { paint: { kind: 'solid', color: '#fff' } } }];
    },
  };
}

function selectionOf(ids: readonly NodeId[]): SelectionApi {
  const noop = (): void => {};
  return {
    current: ids,
    get: () => [...ids],
    set: noop,
    add: noop,
    remove: noop,
    toggle: noop,
    clear: noop,
    contains: (id) => ids.includes(id),
    applyClick: noop,
    adapterMethods: { getSelection: () => [...ids], setSelection: noop },
  };
}

/** Renders a bare `<Canvas>` whose selection and an unrelated counter can each
 *  be moved independently, with every other prop identity held stable. */
function Host({ draw, control }: {
  draw: () => void;
  control: { setSelection?: (ids: string[]) => void; bumpUnrelated?: () => void };
}) {
  const [ids, setIds] = useState<NodeId[]>([]);
  const [, setUnrelated] = useState(0);
  control.setSelection = (next: string[]) => setIds(next.map(asNodeId));
  control.bumpUnrelated = () => setUnrelated((n) => n + 1);

  const layer = useMemo(() => probeLayer(draw), [draw]);
  const layers = useMemo(() => ({ grid: null, probe: { layer } }), [layer]);
  const selection = useMemo(() => selectionOf(ids), [ids]);

  return <Canvas width={100} height={80} layers={layers} selection={selection} />;
}

describe('Canvas repaints on a committed render', () => {
  it('repaints when a bare consumer changes the selection', async () => {
    const draw = vi.fn();
    const control: { setSelection?: (ids: string[]) => void } = {};
    render(<Host draw={draw} control={control} />);
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);

    act(() => { control.setSelection!(['a']); });
    await frame();
    await frame();

    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('paints renders that land before one frame in that frame', async () => {
    const draw = vi.fn();
    const control: { bumpUnrelated?: () => void } = {};
    render(<Host draw={draw} control={control} />);
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 3; i++) act(() => { control.bumpUnrelated!(); });
    await frame();
    await frame();

    expect(draw).toHaveBeenCalledTimes(2);
  });
});
