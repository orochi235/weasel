/**
 * jsdom has no WebGL, so the canvas draws nothing; core's `<Canvas>` is wrapped to capture the
 * `layers` `<SceneCanvas>` hands it, and the scene slot is drawn directly.
 */
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { type Animator } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';
import type { DrawCommand } from '@weasel-js/renderer';
import type { CanvasExtensionApi, CanvasProps, StrokeTrim, View } from '@weasel-js/core';
import type { ForwardedRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagramView } from './DiagramView';
import { diagramScene, edgeIdOf, type DataEdge } from './fromData';

type Drawable = { draw: (data: unknown, view: View, dims: { width: number; height: number; dpr: number }) => DrawCommand[] };
interface CapturedLayers { scene: { layers: ReadonlyArray<{ layer: Drawable }> } }

const captured = vi.hoisted(() => ({ layers: null as unknown }));

vi.mock('../../core/src/canvas/Canvas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/src/canvas/Canvas')>();
  const react = await import('react');
  const Canvas = react.forwardRef(function CanvasSpy(props: CanvasProps<unknown>, ref: ForwardedRef<CanvasExtensionApi>) {
    captured.layers = props.layers;
    return react.createElement(actual.Canvas, { ...props, ref });
  });
  return { ...actual, Canvas };
});

afterEach(() => { cleanup(); });

const EDGE: DataEdge = { from: 'a', to: 'b' };
const SPECS = diagramScene({ nodes: [{ id: 'a', at: { x: 0, y: 0 } }, { id: 'b', at: { x: 300, y: 0 } }], edges: [EDGE] }, { layout: 'none' });
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

const flat = (cmds: readonly DrawCommand[]): DrawCommand[] =>
  cmds.flatMap((cmd) => (cmd.kind === 'group' ? [cmd, ...flat(cmd.children)] : [cmd]));

/** The trims on every stroked path the scene slot paints. */
function paintedTrims(): (StrokeTrim | undefined)[] {
  const layers = captured.layers as CapturedLayers | null;
  if (layers === null) throw new Error('DiagramView rendered no canvas layers');
  return flat(layers.scene.layers.flatMap(({ layer }) => layer.draw(null, VIEW, { width: 400, height: 200, dpr: 1 })))
    .flatMap((c) => (c.kind === 'path' && c.stroke !== undefined ? [c.stroke.trim] : []));
}

describe('DiagramView animator', () => {
  it("paints its animator's trim override on an edge, by the edge's id", async () => {
    let animator: Animator | undefined;
    function Host() {
      animator = useAnimator();
      return <DiagramView specs={SPECS} width={400} height={200} animator={animator} />;
    }
    await act(async () => { render(<Host />); });
    expect(paintedTrims()).not.toContainEqual({ end: 0.5 });
    act(() => { animator!.trimOverrides.set(edgeIdOf(EDGE), { end: 0.5 }); });
    expect(paintedTrims()).toContainEqual({ end: 0.5 });
  });
});
