/**
 * SceneCanvas ↔ ingestion integration — the `ingestion` prop (kit +
 * consumer content-handler registration) and the imperative
 * `CanvasExtensionApi.ingest` entry point, exercised through a real
 * `<SceneCanvas>` mount.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import { SceneCanvas } from './SceneCanvas';
import type { SceneCanvasApi } from './canvasExtension';
import { ActionsProvider } from 'interactions/actions/registry';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import {
  getContentHandlers,
  _resetContentHandlersForTests,
  type ContentHandlerEntry,
} from 'features/ingestion/contentHandlers';
import { _resetKitContentHandlersForTests } from 'features/ingestion/registerKitHandlers';
import {
  __setImageMeasureForTests,
  __setFileToDataUriForTests,
  _resetImageHandlerSeamsForTests,
} from 'features/ingestion/imageHandler';

type D = { image?: { src: string } };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

// Canvas client rect: 200×150 at the origin. At the identity view the
// visible world rect is therefore {0, 0, 200, 150} (world center 100, 75).
const CLIENT_RECT = {
  left: 0, top: 0, right: 200, bottom: 150,
  width: 200, height: 150, x: 0, y: 0,
  toJSON: () => ({}),
} as DOMRect;

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
    getBoundingClientRect: () => DOMRect;
  };
  proto.getContext = vi.fn(() => ({
    canvas: { width: 0, height: 0 },
    clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), setTransform: vi.fn(),
    scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
    font: '', textBaseline: '', globalAlpha: 1,
    fillStyle: '', strokeStyle: '', lineWidth: 1,
  } as unknown as CanvasRenderingContext2D));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.getBoundingClientRect = () => CLIENT_RECT;
});

beforeEach(() => {
  _resetContentHandlersForTests();
  _resetKitContentHandlersForTests();
  _resetImageHandlerSeamsForTests();
});

function makeScene(): Scene<D, L, P> {
  return createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
}

const kitImageCount = () =>
  getContentHandlers().filter((h) => h.id === 'kit:image').length;

function imageNodes(scene: Scene<D, L, P>) {
  return scene.roots
    .map((id) => scene.get(id)!)
    .filter((n) => typeof (n.data as D | undefined)?.image?.src === 'string');
}

function pngFile(name = 'pic.png'): File {
  return new File(['x'], name, { type: 'image/png' });
}

// Module const so the `ingestion` prop is referentially stable across
// renders (SceneCanvas keys its dep wiring off the prop identity).
const RESOLVE_SRC_INGESTION = { resolveSrc: async () => 'https://cdn/x.png' };

describe('SceneCanvas ingestion — handler registration lifecycle', () => {
  it('two mounted canvases share one refcounted kit:image handler', () => {
    const a = render(<SceneCanvas scene={makeScene()} layers={{}} width={64} height={64} />);
    expect(kitImageCount()).toBe(1);
    const b = render(<SceneCanvas scene={makeScene()} layers={{}} width={64} height={64} />);
    expect(kitImageCount()).toBe(1);

    // Unmounting the FIRST mount must not strand the survivor without an
    // image handler (the refcount, not id-dedup, guarantees this).
    a.unmount();
    expect(kitImageCount()).toBe(1);
    b.unmount();
    expect(kitImageCount()).toBe(0);
  });

  it('ingestion.handlers register on mount and dispose on unmount', () => {
    const entry: ContentHandlerEntry = {
      id: 'app:test',
      match: 'text/plain',
      handle: vi.fn(),
    };
    const { unmount } = render(
      <SceneCanvas scene={makeScene()} layers={{}} width={64} height={64}
        ingestion={{ handlers: [entry] }} />,
    );
    expect(getContentHandlers().some((h) => h.id === 'app:test')).toBe(true);
    // Consumer priority (default 0) sorts ahead of the kit's -100.
    const ids = getContentHandlers().map((h) => h.id);
    expect(ids.indexOf('app:test')).toBeLessThan(ids.indexOf('kit:image'));
    unmount();
    expect(getContentHandlers().some((h) => h.id === 'app:test')).toBe(false);
  });
});

describe('SceneCanvasApi.ingest', () => {
  beforeEach(() => {
    __setImageMeasureForTests(async () => ({ width: 100, height: 80 }));
    __setFileToDataUriForTests(async () => 'data:image/png;base64,TEST');
  });

  it('ingest([pngFile], point) inserts an image node centered on the point', async () => {
    const scene = makeScene();
    const ref = createRef<SceneCanvasApi>();
    render(<SceneCanvas scene={scene} layers={{}} width={64} height={64} ref={ref} />);
    expect(ref.current?.ingest).toBeTypeOf('function');

    await act(async () => {
      // `SceneCanvasApi.ingest` is non-optional — no `!` needed on the method.
      ref.current!.ingest([pngFile()], { x: 50, y: 60 });
    });
    await vi.waitFor(() => {
      expect(imageNodes(scene)).toHaveLength(1);
    });

    const node = imageNodes(scene)[0];
    expect((node.data as D).image!.src).toBe('data:image/png;base64,TEST');
    // 100×80 natural size fits inside 90% of the 200×150 world viewport
    // (scale 1), centered on (50, 60) → top-left (0, 20).
    const pose = node.pose as P;
    expect(pose.x).toBeCloseTo(0);
    expect(pose.y).toBeCloseTo(20);
    expect(pose.width).toBeCloseTo(100);
    expect(pose.height).toBeCloseTo(80);
  });

  it('ingest with no point centers the node in the viewport', async () => {
    const scene = makeScene();
    const ref = createRef<SceneCanvasApi>();
    render(<SceneCanvas scene={scene} layers={{}} width={64} height={64} ref={ref} />);

    await act(async () => {
      ref.current!.ingest([pngFile()]);
    });
    await vi.waitFor(() => {
      expect(imageNodes(scene)).toHaveLength(1);
    });

    // World viewport at identity view = {0, 0, 200, 150}; center (100, 75)
    // → 100×80 node top-left at (50, 35).
    const pose = imageNodes(scene)[0].pose as P;
    expect(pose.x).toBeCloseTo(50);
    expect(pose.y).toBeCloseTo(35);
    expect(pose.width).toBeCloseTo(100);
    expect(pose.height).toBeCloseTo(80);
  });

  it('works under a consumer root <ActionsProvider> mounted above SceneCanvas', async () => {
    // Regression: a root ActionsProvider (the demo site's keydown
    // consolidation pattern) sits OUTSIDE any DepRegistryProvider, so its
    // trigger() saw no dep registry and the ingest invoker bailed silently.
    // SceneCanvas must wire its own dep registry into whatever registry is
    // in scope, same as it wires the dispatcher.
    const scene = makeScene();
    const ref = createRef<SceneCanvasApi>();
    render(
      <ActionsProvider>
        <SceneCanvas scene={scene} layers={{}} width={64} height={64} ref={ref} />
      </ActionsProvider>,
    );

    await act(async () => {
      ref.current!.ingest([pngFile()], { x: 50, y: 60 });
    });
    await vi.waitFor(() => {
      expect(imageNodes(scene)).toHaveLength(1);
    });
  });

  it('ingestion.resolveSrc overrides the data-URI embed end-to-end', async () => {
    const scene = makeScene();
    const ref = createRef<SceneCanvasApi>();
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64} ref={ref}
        ingestion={RESOLVE_SRC_INGESTION} />,
    );

    await act(async () => {
      ref.current!.ingest([pngFile()], { x: 10, y: 10 });
    });
    await vi.waitFor(() => {
      expect(imageNodes(scene)).toHaveLength(1);
    });

    // The consumer resolver's URL landed on the node — not the data URI the
    // (still-stubbed) fileToDataUri seam would have produced.
    expect((imageNodes(scene)[0].data as D).image!.src).toBe('https://cdn/x.png');
  });
});
