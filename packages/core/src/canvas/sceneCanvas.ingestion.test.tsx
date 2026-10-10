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
import type { Feature } from './SceneCanvas/features';
import { ActionsProvider } from '@weasel-js/routing/react';
// The real unpacker, to keep this an end-to-end check of the injected seam.
import { unpackSvgFiles } from '@weasel-js/svg';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import {
  getContentHandlers,
  registerContentHandler,
  _resetContentHandlersForTests,
  type ContentHandlerEntry,
} from 'features/ingestion/contentHandlers';
import { _resetKitContentHandlersForTests } from 'features/ingestion/registerKitHandlers';
import {
  __setImageMeasureForTests,
  __setFileToDataUriForTests,
  _resetImageHandlerSeamsForTests,
} from 'features/ingestion/imageHandler';
import {
  __setSvgMeasureForTests,
  _resetSvgHandlerSeamsForTests,
} from 'features/ingestion/svgHandler';
import { buildWeaselClipboardText } from 'interactions/actions/clipboard/wireFormat';

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
  _resetSvgHandlerSeamsForTests();
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

// Module consts so the `ingestion` prop is referentially stable across
// renders (SceneCanvas keys its dep wiring off the prop identity).
const RESOLVE_SRC_INGESTION = { resolveSrc: async () => 'https://cdn/x.png' };
const UNPACK_INGESTION = { svg: { unpack: unpackSvgFiles } };
const CLIPBOARD_DISABLED_INGESTION = { clipboard: { enabled: false } };

describe('SceneCanvas ingestion — handler registration lifecycle', () => {
  it('two mounted canvases share one refcounted kit:image handler', () => {
    const a = render(<SceneCanvas features={['draw']} scene={makeScene()} layers={{}} width={64} height={64} />);
    expect(kitImageCount()).toBe(1);
    const b = render(<SceneCanvas features={['draw']} scene={makeScene()} layers={{}} width={64} height={64} />);
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
      <SceneCanvas features={['draw']} scene={makeScene()} layers={{}} width={64} height={64}
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
    render(<SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64} ref={ref} />);
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
    render(<SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64} ref={ref} />);

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

  it('an SVG file embeds as ONE image node with a data:image/svg+xml src (default)', async () => {
    __setSvgMeasureForTests(async () => ({ width: 100, height: 80 }));
    const scene = makeScene();
    const ref = createRef<SceneCanvasApi>();
    render(<SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64} ref={ref} />);

    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'art.svg', { type: 'image/svg+xml' });
    await act(async () => {
      ref.current!.ingest([svg], { x: 50, y: 60 });
    });
    await vi.waitFor(() => {
      expect(scene.roots).toHaveLength(1);
    });

    const node = scene.get(scene.roots[0])!;
    expect(node.kind).toBe('leaf');
    // The stubbed embed seam reports the file's own MIME; the SVG handler
    // must have forced image/svg+xml regardless.
    expect((node.data as D).image!.src).toMatch(/^data:image\/svg\+xml/);
  });

  it('ingestion.svg.unpack parses an SVG file into native scene nodes', async () => {
    const scene = makeScene();
    const ref = createRef<SceneCanvasApi>();
    render(
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64} ref={ref}
        ingestion={UNPACK_INGESTION} />,
    );

    const svg = new File([
      `<svg xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="40" height="30" fill="#ff0000"/>
        <g><rect x="50" y="50" width="10" height="10" fill="#00ff00"/></g>
      </svg>`,
    ], 'art.svg', { type: 'image/svg+xml' });
    await act(async () => {
      ref.current!.ingest([svg], { x: 100, y: 75 });
    });
    await vi.waitFor(() => {
      expect(scene.roots).toHaveLength(1);
    });

    // Multi-root file → one wrapper container holding the rect leaf and the
    // <g> container (which holds the inner rect leaf).
    const wrapper = scene.get(scene.roots[0])!;
    expect(wrapper.kind).toBe('container');
    const children = scene.childrenOf(scene.roots[0]).map((id) => scene.get(id)!);
    expect(children).toHaveLength(2);
    const leaf = children.find((n) => n.kind === 'leaf')!;
    const group = children.find((n) => n.kind === 'container')!;
    expect(leaf).toBeDefined();
    expect(group).toBeDefined();
    const leafData = leaf.data as { path?: { kind: string }; fill?: { color?: string } };
    expect(leafData.path?.kind).toBeDefined();
    expect(leafData.fill).toEqual({ color: '#ff0000' });
    // Undoable: one batch → a single undo removes the whole import.
    act(() => scene.undo());
    expect(scene.roots).toHaveLength(0);
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
        <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64} ref={ref} />
      </ActionsProvider>,
    );

    await act(async () => {
      ref.current!.ingest([pngFile()], { x: 50, y: 60 });
    });
    await vi.waitFor(() => {
      expect(imageNodes(scene)).toHaveLength(1);
    });
  });

  it('a weasel-JSON payload pastes through the canvas adapter (fresh id, cascade offset, one undo)', async () => {
    const scene = makeScene();
    const ref = createRef<SceneCanvasApi>();
    render(<SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64} ref={ref} />);

    const text = buildWeaselClipboardText([
      {
        kind: 'leaf', id: 'src-1', layer: 'main', parent: null,
        pose: { x: 10, y: 10, width: 20, height: 20 }, data: {},
      },
    ]);
    await act(async () => {
      ref.current!.ingest([{ kind: 'string', mime: 'text/plain', text }]);
    });
    await vi.waitFor(() => {
      expect(scene.roots).toHaveLength(1);
    });

    const node = scene.get(scene.roots[0])!;
    expect(node.id).not.toBe('src-1'); // fresh id, not the wire id
    const pose = node.pose as P;
    expect(pose.x).toBeCloseTo(22); // 10 + the 12px cascade offset
    expect(pose.y).toBeCloseTo(22);
    // One undo entry for the whole paste (insert + selection ops batched).
    act(() => scene.undo());
    expect(scene.roots).toHaveLength(0);
  });

  it('ingestion.clipboard.enabled === false leaves weasel payloads un-ingested', async () => {
    const scene = makeScene();
    const ref = createRef<SceneCanvasApi>();
    render(
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64} ref={ref}
        ingestion={CLIPBOARD_DISABLED_INGESTION} />,
    );

    const text = buildWeaselClipboardText([
      {
        kind: 'leaf', id: 'src-1', layer: 'main', parent: null,
        pose: { x: 10, y: 10, width: 20, height: 20 }, data: {},
      },
    ]);
    await act(async () => {
      ref.current!.ingest([{ kind: 'string', mime: 'text/plain', text }]);
      // Let the fire-and-forget ingest pipeline flush before asserting.
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(scene.roots).toHaveLength(0);
  });

  it('ingestion.resolveSrc overrides the data-URI embed end-to-end', async () => {
    const scene = makeScene();
    const ref = createRef<SceneCanvasApi>();
    render(
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64} ref={ref}
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

// jsdom has no ClipboardEvent, DragEvent, or DataTransfer, so these events are
// plain `Event`s carrying the fields the dispatcher's listeners read. They
// prove what the canvas does with a paste or drop it is handed, not that a
// browser hands it one; `ingest` alone inserting from the same events is the
// control that they carry content at all.
describe('SceneCanvas paste and drop events, by preset', () => {
  beforeEach(() => {
    __setImageMeasureForTests(async () => ({ width: 100, height: 80 }));
    __setFileToDataUriForTests(async () => 'data:image/png;base64,TEST');
    __setSvgMeasureForTests(async () => ({ width: 100, height: 80 }));
  });

  const NODE_TEXT = buildWeaselClipboardText([
    {
      kind: 'leaf', id: 'src-1', layer: 'main', parent: null,
      pose: { x: 10, y: 10, width: 20, height: 20 }, data: {},
    },
  ]);
  const SVG_TEXT = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';

  function mount(features: readonly Feature[]) {
    const scene = makeScene();
    const { container } = render(
      <SceneCanvas features={features} scene={scene} layers={{}} width={64} height={64} />,
    );
    return { scene, canvas: container.querySelector('canvas')! };
  }

  function paste(data: { text?: string; files?: File[] }): Event {
    const ev = new Event('paste', { cancelable: true });
    Object.assign(ev, {
      clipboardData: {
        files: data.files ?? [],
        getData: (t: string) => (t === 'text/plain' ? data.text ?? '' : ''),
      },
    });
    act(() => { window.dispatchEvent(ev); });
    return ev;
  }

  function dropFile(canvas: Element, file: File): void {
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.assign(ev, {
      dataTransfer: { items: [], files: [file] },
      clientX: 50, clientY: 60,
      altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    });
    act(() => { canvas.dispatchEvent(ev); });
  }

  /** Long enough for the fire-and-forget ingest pipeline to have inserted. */
  const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

  it('edit alone pastes copied nodes from a paste event', async () => {
    const { scene } = mount(['edit']);
    const ev = paste({ text: NODE_TEXT });
    await vi.waitFor(() => expect(scene.roots).toHaveLength(1));
    expect(scene.get(scene.roots[0])!.id).not.toBe('src-1');
    expect(ev.defaultPrevented).toBe(true);
    act(() => scene.undo());
    expect(scene.roots).toHaveLength(0);
  });

  it('edit alone honors ingestion.clipboard.enabled === false', async () => {
    const scene = makeScene();
    render(
      <SceneCanvas features={['edit']} scene={scene} layers={{}} width={64} height={64}
        ingestion={CLIPBOARD_DISABLED_INGESTION} />,
    );
    paste({ text: NODE_TEXT });
    await settle();
    expect(scene.roots).toHaveLength(0);
  });

  it('edit alone leaves a pasted image to the page', async () => {
    const { scene } = mount(['edit']);
    const ev = paste({ files: [pngFile()] });
    await settle();
    expect(scene.roots).toHaveLength(0);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('edit alone inserts nothing for pasted SVG text or a pasted SVG file', async () => {
    const { scene } = mount(['edit']);
    paste({ text: SVG_TEXT });
    paste({ files: [new File([SVG_TEXT], 'art.svg', { type: 'image/svg+xml' })] });
    await settle();
    expect(scene.roots).toHaveLength(0);
  });

  it('edit alone ignores a drop', async () => {
    const { scene, canvas } = mount(['edit']);
    dropFile(canvas, pngFile());
    await settle();
    expect(scene.roots).toHaveLength(0);
  });

  it('edit alone runs no handler another canvas registered', async () => {
    const handle = vi.fn();
    // A bare canvas registers its `ingestion.handlers` and binds no paste, so
    // only the edit canvas answers the event.
    render(
      <SceneCanvas scene={makeScene()} layers={{}} width={64} height={64}
        ingestion={{ handlers: [{ id: 'app:text', match: 'text/plain', handle }] }} />,
    );
    expect(getContentHandlers().some((h) => h.id === 'app:text')).toBe(true);
    const { scene } = mount(['edit']);
    paste({ text: NODE_TEXT });
    paste({ text: 'plain words' });
    await vi.waitFor(() => expect(scene.roots).toHaveLength(1));
    await settle();
    expect(handle).not.toHaveBeenCalled();
  });

  it('edit with ingest pastes copied nodes once, and still pastes SVG text', async () => {
    const { scene } = mount(['edit', 'ingest']);
    paste({ text: NODE_TEXT });
    await settle();
    expect(scene.roots).toHaveLength(1);
    // The dispatcher runs one binding per event, so a second paste cannot
    // show here; what shows `ingest` answered is content only it accepts.
    paste({ text: SVG_TEXT });
    await vi.waitFor(() => expect(scene.roots).toHaveLength(2));
  });

  it('ingest alone still pastes nodes, images, and SVG, and takes drops', async () => {
    const { scene, canvas } = mount(['ingest']);
    paste({ text: NODE_TEXT });
    await vi.waitFor(() => expect(scene.roots).toHaveLength(1));
    const img = paste({ files: [pngFile()] });
    expect(img.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(scene.roots).toHaveLength(2));
    paste({ text: SVG_TEXT });
    await vi.waitFor(() => expect(scene.roots).toHaveLength(3));
    dropFile(canvas, pngFile());
    await vi.waitFor(() => expect(scene.roots).toHaveLength(4));
  });

  it('ingest alone runs a registered consumer handler on a paste', async () => {
    const handle = vi.fn();
    const off = registerContentHandler({ id: 'app:text', match: 'text/plain', handle });
    mount(['ingest']);
    paste({ text: 'plain words' });
    await vi.waitFor(() => expect(handle).toHaveBeenCalledTimes(1));
    off();
  });
});
