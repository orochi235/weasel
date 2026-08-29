import { beforeAll, describe, expect, it } from 'vitest';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ActionsProvider,
  createDispatcher,
  createScene,
  asNodeId,
  useActionsRegistry,
  type Action,
  type FillStyle,
  type GradientFill,
  type RectPose,
  type Stroke,
} from '@weasel-js/core';
import { SceneGradientHandles } from './SceneGradientHandles';

const STOPS = [
  { offset: 0, color: '#000000' },
  { offset: 1, color: '#ffffff' },
];

/** A left-to-right ramp across the node's box, in the frame the node stores. */
const BOUNDS_RAMP: GradientFill = {
  fill: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 1, y: 0 },
  stops: STOPS,
  units: 'bounds',
};

beforeAll(() => {
  class StubRO {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as unknown as { ResizeObserver: typeof StubRO }).ResizeObserver = StubRO;
  // jsdom implements neither pointer capture nor SVG layout. One rect for
  // every element makes overlay pixels and client coordinates the same space.
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 300, width: 400, height: 300, toJSON: () => {} } as DOMRect;
  };
});

interface Data { fill?: FillStyle | null; stroke?: Stroke | null }
type Layer = 'main';

function sceneWith(pose: RectPose, data: Data): ReturnType<typeof createScene<Data, Layer>> {
  const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: asNodeId('a'), kind: 'leaf', layer: 'main', pose, data });
  return scene;
}

/** Records the params every ongoing invocation of `id` sees. */
function recorder(id: string, seen: Record<string, unknown>[]): Action {
  return {
    id,
    label: id,
    invoker: {
      timing: 'ongoing',
      start: (ctx) => {
        seen.push({ action: id, phase: 'start', ...ctx.params });
        return {
          onMove: (move) => { seen.push({ action: id, phase: 'move', ...move.params }); },
          onEnd: () => {},
        };
      },
    },
  };
}

/** Registers stub `setFill` / `setStroke` actions and only then mounts the
 *  overlay — `begin` resolves against the registry at call time. */
function Harness(props: { seen: Record<string, unknown>[]; children: ReactNode }): ReactElement | null {
  const registry = useActionsRegistry();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!registry) return;
    registry.register(recorder('setFill', props.seen));
    registry.register(recorder('setStroke', props.seen));
    registry.setDispatcher(createDispatcher({
      getAction: (id: string) => registry.list().find((a) => a.id === id),
    }));
    setReady(true);
  }, [registry, props.seen]);
  return ready ? <>{props.children}</> : null;
}

function Overlay(props: {
  scene: ReturnType<typeof createScene<Data, Layer>>;
  slot: 'fill' | 'stroke';
  seen: Record<string, unknown>[];
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <ActionsProvider>
      <div ref={ref}>
        <Harness seen={props.seen}>
          <SceneGradientHandles scene={props.scene} containerRef={ref} nodeId="a" slot={props.slot} />
        </Harness>
      </div>
    </ActionsProvider>
  );
}

function drag(label: string, to: { x: number; y: number }): void {
  const handle = screen.getByLabelText(label);
  fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: to.x, clientY: to.y, pointerId: 1 });
  fireEvent.pointerUp(handle, { clientX: to.x, clientY: to.y, pointerId: 1 });
}

const BOX: RectPose = { x: 0, y: 0, width: 200, height: 100 };

function expectAt(label: string, x: number, y: number): void {
  const el = screen.getByLabelText(label);
  expect(Number(el.getAttribute('cx'))).toBeCloseTo(x, 6);
  expect(Number(el.getAttribute('cy'))).toBeCloseTo(y, 6);
}

describe('SceneGradientHandles', () => {
  it('draws nothing when the targeted slot holds no gradient', () => {
    const scene = sceneWith(BOX, { fill: { fill: 'solid', color: '#ff0000' } });
    render(<Overlay scene={scene} slot="fill" seen={[]} />);
    expect(screen.queryByLabelText('Gradient start')).toBeNull();
  });

  it('reads the slot it is given, not whichever paint the node has', () => {
    const scene = sceneWith(BOX, {
      fill: { fill: 'solid', color: '#ff0000' },
      stroke: { paint: BOUNDS_RAMP, width: 2 },
    });
    const { rerender } = render(<Overlay scene={scene} slot="fill" seen={[]} />);
    expect(screen.queryByLabelText('Gradient start')).toBeNull();
    rerender(<Overlay scene={scene} slot="stroke" seen={[]} />);
    expect(screen.getByLabelText('Gradient start')).toBeInTheDocument();
  });

  it('resolves the stored bounds-frame gradient onto the node box', () => {
    const scene = sceneWith(BOX, { fill: BOUNDS_RAMP });
    render(<Overlay scene={scene} slot="fill" seen={[]} />);
    expect(screen.getByLabelText('Gradient start')).toHaveAttribute('cx', '0');
    expect(screen.getByLabelText('Gradient end')).toHaveAttribute('cx', '200');
  });

  // The regression: the handles must sit on the paint the renderer draws, and
  // the renderer rotates the node.
  it('places the handles on a rotated node where the paint actually is', () => {
    const scene = sceneWith({ x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2 },
      { fill: BOUNDS_RAMP });
    render(<Overlay scene={scene} slot="fill" seen={[]} />);
    // Unrotated the ramp would run (0,0)→(100,0); the quarter turn swings it
    // down the box's right edge.
    expectAt('Gradient start', 100, 0);
    expectAt('Gradient end', 100, 100);
  });

  it('commits a dragged handle back through setFill in the bounds frame', () => {
    const seen: Record<string, unknown>[] = [];
    const scene = sceneWith(BOX, { fill: BOUNDS_RAMP });
    render(<Overlay scene={scene} slot="fill" seen={seen} />);
    drag('Gradient end', { x: 100, y: 50 });

    expect(seen.at(-1)).toMatchObject({
      action: 'setFill',
      paint: { fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 0.5, y: 0.5 }, units: 'bounds' },
    });
  });

  it('commits through setStroke when the slot is the stroke', () => {
    const seen: Record<string, unknown>[] = [];
    const scene = sceneWith(BOX, { stroke: { paint: BOUNDS_RAMP, width: 2 } });
    render(<Overlay scene={scene} slot="stroke" seen={seen} />);
    drag('Gradient end', { x: 100, y: 50 });

    expect(seen.at(-1)).toMatchObject({
      action: 'setStroke',
      paint: { to: { x: 0.5, y: 0.5 }, units: 'bounds' },
    });
  });
});
