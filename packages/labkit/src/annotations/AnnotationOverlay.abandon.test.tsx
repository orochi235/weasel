/**
 * What an overlay reads outside render — the insert factory's tool and config,
 * and the buffer its clear opens — comes from the render that committed, never
 * from one React started and threw away.
 *
 * `<SceneCanvas>` is stubbed: jsdom has no WebGL2, so the real one never
 * paints, and a pane that has not painted never clears. The stub hands the
 * overlay a frame subscription the test can fire, and keeps the committed
 * insert factories.
 */
import type { InsertNodeFactory, SceneCanvasApi } from '@weasel-js/core';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { type Ref, useLayoutEffect } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SurfaceCanvasContext, SurfaceContext } from '../surface/SurfaceContext';
import type { SurfaceClear, SurfaceHandle, TilePainter } from '../surface/useTiledSurface';
import { AnnotationOverlay } from './AnnotationOverlay';
import { seenFrom } from './staleness';
import { createAnnotationScene } from './store';
import type { AnnotationTarget } from './types';

const frames = new Set<() => void>();
let factories: Record<string, InsertNodeFactory> = {};

vi.mock('@weasel-js/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weasel-js/core')>();
  function SceneCanvas(props: {
    ref?: Ref<SceneCanvasApi | null>;
    insertNodeFactories: Record<string, InsertNodeFactory>;
  }) {
    const { ref, insertNodeFactories } = props;
    useLayoutEffect(() => {
      factories = insertNodeFactories;
    });
    useLayoutEffect(() => {
      if (typeof ref !== 'function') return;
      const api = {
        subscribeFrame: (fn: () => void) => {
          frames.add(fn);
          return () => frames.delete(fn);
        },
        requestRedraw: () => {},
      } as unknown as SceneCanvasApi;
      ref(api);
      return () => {
        ref(null);
      };
    }, [ref]);
    return null;
  }
  return { ...actual, SceneCanvas };
});

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

/** A surface that measures every tile at once, so the pane mounts its canvas
 *  inside the first commit. */
function surfaceFor(clears: SurfaceClear[]): SurfaceHandle {
  const container = document.createElement('div');
  return {
    invalidate: () => {},
    invalidateAll: () => {},
    invalidateRects: () => {},
    invalidateBox: () => {},
    registerTile: () => {},
    registerClear: (_id, clear) => {
      clears.push(clear);
      return () => {};
    },
    registerPainter: (_id, paint: TilePainter) => {
      paint({ x: 0, y: 0, w: 100, h: 50 }, {} as never);
      return () => {};
    },
    containerRef: () => {},
    getContainer: () => container,
  } as SurfaceHandle;
}

const target: AnnotationTarget = {
  id: 'pane',
  ref: { current: null },
  content: { w: 100, h: 50 },
  positionDependsOn: ['k'],
};

interface Props {
  toolId: string;
  config: { k: number };
  canvas: HTMLCanvasElement;
}

const committed = document.createElement('canvas');
const abandoned = document.createElement('canvas');

/** Commits a pane holding `line` on `committed`, then abandons one holding
 *  `arrow` on `abandoned`. Returns the clears the pane registered. */
function mountThenAbandon(): SurfaceClear[] {
  const clears: SurfaceClear[] = [];
  const surface = surfaceFor(clears);
  const scene = createAnnotationScene();
  renderThenAbandon<Props>(
    { toolId: 'line', config: { k: 1 }, canvas: committed },
    { toolId: 'arrow', config: { k: 2 }, canvas: abandoned },
    (p) => (
      <SurfaceContext.Provider value={surface}>
        <SurfaceCanvasContext.Provider value={{ over: p.canvas, under: null }}>
          <AnnotationOverlay
            target={target}
            scene={scene}
            config={p.config}
            activeToolId={p.toolId}
          />
        </SurfaceCanvasContext.Provider>
      </SurfaceContext.Provider>
    ),
  );
  return clears;
}

describe('<AnnotationOverlay> across an abandoned render', () => {
  it('mints a mark with the committed tool and config', () => {
    mountThenAbandon();
    // `line` and `arrow` drive the same weasel tool; only the tool id the
    // factory reads tells them apart.
    const made = factories.line?.({ x: 0, y: 0, width: 1, height: 1 }, {} as never);
    expect(made?.data).toMatchObject({ kind: 'line', seen: seenFrom({ k: 1 }, ['k']) });
  });

  it('clears the committed buffer', () => {
    const clears = mountThenAbandon();
    for (const fn of frames) fn();
    // One mock on the prototype serves every canvas; `this` tells them apart.
    const open = vi.mocked(HTMLCanvasElement.prototype.getContext);
    open.mockClear();
    for (const clear of clears) clear({ width: 100, height: 50 }, 1);
    // By identity: two blank canvases are deeply equal.
    expect(open.mock.contexts).toHaveLength(1);
    expect(open.mock.contexts[0]).toBe(committed);
  });
});
