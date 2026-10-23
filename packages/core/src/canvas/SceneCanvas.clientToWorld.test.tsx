/**
 * A `<SceneCanvas clientToWorld>` override reaches every conversion the
 * component makes for its own view: the dispatcher's world and canvas-local
 * points, the published pointer position, and hover.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createModeRegistry, DEFAULT_MODES } from '@weasel-js/modes';
import type { RuleCtx } from '@weasel-js/routing';
import type { UseGestureDispatcherOptions } from '@weasel-js/routing/react';
import { PointerContextProvider, createPointerStore } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { SceneCanvas } from './SceneCanvas';

type P = { x: number; y: number; width: number; height: number };

const seen: {
  getRuleCtx: (() => RuleCtx | undefined) | undefined;
  clientToLocal: UseGestureDispatcherOptions['clientToLocal'];
} = { getRuleCtx: undefined, clientToLocal: undefined };

vi.mock('@weasel-js/routing/react', async (importOriginal) => {
  const real = await importOriginal<typeof import('@weasel-js/routing/react')>();
  return {
    ...real,
    useGestureDispatcher: (opts: UseGestureDispatcherOptions) => {
      seen.clientToLocal = opts.clientToLocal;
      real.useGestureDispatcher(opts);
    },
  };
});

vi.mock('./SceneCanvas/useSceneGestureDispatcher', async (importOriginal) => {
  const real = await importOriginal<typeof import('./SceneCanvas/useSceneGestureDispatcher')>();
  return {
    ...real,
    useSceneGestureDispatcher: (props: Parameters<typeof real.useSceneGestureDispatcher>[0]) => {
      seen.getRuleCtx = props.getRuleCtx;
      real.useSceneGestureDispatcher(props);
    },
  };
});

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(() => cleanup());

const ID = asNodeId('a');
const LEFT = 10;
const TOP = 20;

/** A canvas drawn at half size by a CSS transform: two client pixels per
 *  world unit, from the element's corner. */
function halfScale(el: HTMLElement, clientX: number, clientY: number): [number, number] {
  const r = el.getBoundingClientRect();
  return [(clientX - r.left) / 2, (clientY - r.top) / 2];
}

/** Inside the node through the override, at world (150, 125); outside it
 *  through the element rect alone, at world (300, 250). */
const CLIENT = { x: LEFT + 300, y: TOP + 250 };

function mount() {
  const scene = createScene<{ kind: 'rect' }, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: ID, kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 100, y: 100, width: 80, height: 60 } });
  const pointer = createPointerStore();
  const onClick = vi.fn();
  const modes = createModeRegistry({ modes: DEFAULT_MODES, initial: DEFAULT_MODES[0].id });
  const { container } = render(
    <PointerContextProvider store={pointer}>
      <SceneCanvas
        features={['pick']} scene={scene} layers={{}} width={400} height={400}
        clientToWorld={halfScale} onClick={onClick}
        modes={modes} chromeVisibility={{}}
      />
    </PointerContextProvider>,
  );
  const canvas = container.querySelector('canvas')!;
  canvas.getBoundingClientRect = () => ({
    left: LEFT, top: TOP, right: LEFT + 400, bottom: TOP + 400, width: 400, height: 400,
    x: LEFT, y: TOP, toJSON: () => ({}),
  });
  const fire = (type: string) => act(() => {
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: CLIENT.x, clientY: CLIENT.y, pointerId: 1 }));
  });
  return { pointer, onClick, fire };
}

describe('<SceneCanvas clientToWorld>', () => {
  it('converts the dispatcher\'s pointer positions with the override', () => {
    const { onClick, fire } = mount();
    fire('pointerdown');
    fire('pointerup');
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0]![0]).toMatchObject({ id: ID });
  });

  it('hands the dispatcher a canvas-local point through the override', () => {
    mount();
    expect(seen.clientToLocal!(CLIENT.x, CLIENT.y)).toEqual({ x: 150, y: 125 });
  });

  it('publishes the pointer position converted with the override', () => {
    const { pointer, fire } = mount();
    fire('pointermove');
    expect(pointer.get()).toEqual({ worldX: 150, worldY: 125, viewId: null });
  });

  it('finds the hovered node at the point the override converts to', () => {
    const { fire } = mount();
    fire('pointermove');
    expect(seen.getRuleCtx!()!.hover).toBe(ID);
  });
});
