/**
 * `CanvasHelpers.getGestureBounds()` / `subscribeGestures()` /
 * `getGestureVersion()` — the in-flight gesture surface consumers read
 * through `helpersRef`.
 *
 * Two sources feed the bounds: tool-published previews (`Tool.previewIds` /
 * `previewPose` / `previewBounds`) and the `GestureSource` `<SceneCanvas>`
 * wires from the gesture dispatcher. Both are stubbed here — the dispatcher's
 * own half is covered in `SceneCanvas/dispatcherGestureBounds.test.ts`.
 */
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { Canvas, type CanvasHelpers } from './Canvas';
import type { GestureSource } from './gestureBounds';
import type { AnyTool } from 'tools/types';
import type { ToolsApi } from 'tools/useTools';

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

interface Pose { x: number; y: number; width: number; height: number; rotation?: number }

const NODES: Record<string, Pose> = {
  a: { x: 0, y: 0, width: 10, height: 10 },
  b: { x: 100, y: 100, width: 10, height: 10 },
};

const adapter = {
  getNodes: () => Object.entries(NODES).map(([id, p]) => ({ id, ...p })),
  getNode: (id: string) => (NODES[id] ? { id, ...NODES[id] } : undefined),
  getPose: (id: string): Pose | null => NODES[id] ?? null,
  setPose: () => {},
  getSelected: () => [],
  setSelected: () => {},
};

/** Minimal ToolsApi carrying one tool — Canvas only reads the slots and
 *  `getActiveOverlays()`. */
function toolsWith(tool: Partial<AnyTool>): ToolsApi {
  const t = { id: 'stub', ...tool } as AnyTool;
  return {
    active: 'stub',
    setActive: () => {},
    hotkeyEngaged: null,
    engageHotkey: () => {},
    disengageHotkey: () => {},
    ambient: [],
    registry: { stub: t },
    has: (id: string) => id === 'stub',
    getActiveOverlays: () => [],
  };
}

/** A GestureSource with only the parts a given test cares about. */
function sourceOf(parts: Partial<GestureSource>): GestureSource {
  return {
    ids: () => null,
    bounds: () => null,
    subscribe: () => () => {},
    getVersion: () => 0,
    ...parts,
  };
}

function renderHelpers(props: {
  tools?: ToolsApi;
  gestureSource?: GestureSource;
}): CanvasHelpers<Pose> {
  const helpersRef: React.MutableRefObject<CanvasHelpers<Pose> | null> = { current: null };
  render(
    <Canvas
      width={200}
      height={200}
      layers={{}}
      adapter={adapter as never}
      helpersRef={helpersRef as never}
      tools={props.tools}
      gestureSource={props.gestureSource}
    />,
  );
  return helpersRef.current!;
}

describe('CanvasHelpers.getGestureBounds', () => {
  it('returns null with no gesture in flight', () => {
    const helpers = renderHelpers({});
    expect(helpers.getGestureBounds()).toBeNull();
  });

  it('returns null when a gesture source is wired but nothing is in flight', () => {
    const helpers = renderHelpers({ gestureSource: sourceOf({}) });
    expect(helpers.getGestureBounds()).toBeNull();
  });

  it('mid-move on one node: equals that node\'s preview bounds, not its committed box', () => {
    const helpers = renderHelpers({
      tools: toolsWith({
        previewIds: () => ['a'],
        previewPose: (id) => (id === 'a' ? { x: 50, y: 60, width: 10, height: 10 } : null),
      }),
    });
    expect(helpers.getGestureBounds()).toEqual({ x: 50, y: 60, width: 10, height: 10 });
  });

  it('mid-move on a multi-selection: the union, not the primary\'s box', () => {
    const poses: Record<string, Pose> = {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 90, y: 40, width: 10, height: 10 },
    };
    const helpers = renderHelpers({
      tools: toolsWith({
        previewIds: () => ['a', 'b'],
        previewPose: (id) => poses[id] ?? null,
      }),
    });
    expect(helpers.getGestureBounds()).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  it('mid-insert with no committed node: equals the insertPreview bounds', () => {
    // The case the whole method exists for — a nascent insert has no id, so it
    // arrives through the gesture source's id-less bounds channel.
    const helpers = renderHelpers({
      gestureSource: sourceOf({ bounds: () => [{ x: 20, y: 5, width: 40, height: 30 }] }),
    });
    expect(helpers.getGestureBounds()).toEqual({ x: 20, y: 5, width: 40, height: 30 });
  });

  it('a marquee in flight returns null', () => {
    // The gesture source reports only content-proposing overlays, so a marquee
    // reaches Canvas as nothing at all — a selection sweep must not grow a
    // consumer that sizes itself to the gesture.
    const helpers = renderHelpers({ gestureSource: sourceOf({ ids: () => [], bounds: () => [] }) });
    expect(helpers.getGestureBounds()).toBeNull();
  });

  it('insert and move in flight together: the union of both', () => {
    const helpers = renderHelpers({
      tools: toolsWith({
        previewIds: () => ['a'],
        previewPose: (id) => (id === 'a' ? { x: 0, y: 0, width: 10, height: 10 } : null),
      }),
      gestureSource: sourceOf({ bounds: () => [{ x: 200, y: 150, width: 20, height: 20 }] }),
    });
    expect(helpers.getGestureBounds()).toEqual({ x: 0, y: 0, width: 220, height: 170 });
  });

  it('resolves dispatcher-side ids through the same preview lookup as the ghosts', () => {
    // Dispatcher handles publish ids; Canvas resolves each one's pose via
    // previewPoseExtra (what <SceneCanvas> wires) — same path the preview-ghost
    // layer paints from.
    const helpersRef: React.MutableRefObject<CanvasHelpers<Pose> | null> = { current: null };
    render(
      <Canvas
        width={200}
        height={200}
        layers={{}}
        adapter={adapter as never}
        helpersRef={helpersRef as never}
        gestureSource={sourceOf({ ids: () => ['b'] })}
        previewPoseExtra={(id) => (id === 'b' ? { x: 70, y: 70, width: 10, height: 10 } : null)}
      />,
    );
    expect(helpersRef.current!.getGestureBounds()).toEqual({ x: 70, y: 70, width: 10, height: 10 });
  });

  it('folds a rotated preview by its rotated extent and reports no rotation', () => {
    const helpers = renderHelpers({
      tools: toolsWith({
        previewIds: () => ['a'],
        previewBounds: () => ({ x: 0, y: 0, width: 10, height: 10, rotation: Math.PI / 4 }),
      }),
    });
    const b = helpers.getGestureBounds()!;
    expect(b.width).toBeCloseTo(10 * Math.SQRT2, 5);
    expect('rotation' in b).toBe(false);
  });

  it('skips in-flight ids that resolve to no preview at all', () => {
    const helpers = renderHelpers({
      tools: toolsWith({
        previewIds: () => ['a', 'ghost-with-no-pose'],
        previewPose: (id) => (id === 'a' ? { x: 1, y: 1, width: 2, height: 2 } : null),
      }),
    });
    expect(helpers.getGestureBounds()).toEqual({ x: 1, y: 1, width: 2, height: 2 });
  });

  it('reports the gesture, not the document — committed nodes are excluded', () => {
    // `b` sits at (100,100) in the adapter and is never previewed; it must not
    // appear in the union.
    const helpers = renderHelpers({
      tools: toolsWith({
        previewIds: () => ['a'],
        previewPose: (id) => (id === 'a' ? { x: 0, y: 0, width: 10, height: 10 } : null),
      }),
    });
    expect(helpers.getGestureBounds()).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });
});

describe('CanvasHelpers.subscribeGestures / getGestureVersion', () => {
  it('forwards subscription and version to the gesture source', () => {
    const subscribers = new Set<() => void>();
    let version = 0;
    const helpers = renderHelpers({
      gestureSource: sourceOf({
        subscribe: (fn) => { subscribers.add(fn); return () => { subscribers.delete(fn); }; },
        getVersion: () => version,
      }),
    });

    let fired = 0;
    const unsubscribe = helpers.subscribeGestures(() => { fired++; });
    expect(helpers.getGestureVersion()).toBe(0);

    version = 1;
    for (const fn of subscribers) fn();
    expect(fired).toBe(1);
    expect(helpers.getGestureVersion()).toBe(1);

    unsubscribe();
    for (const fn of subscribers) fn();
    expect(fired).toBe(1);
  });

  it('without a gesture source: a real unsubscribe that never fires, version 0', () => {
    const helpers = renderHelpers({});
    const unsubscribe = helpers.subscribeGestures(() => {
      throw new Error('must never fire');
    });
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
    expect(helpers.getGestureVersion()).toBe(0);
  });
});
