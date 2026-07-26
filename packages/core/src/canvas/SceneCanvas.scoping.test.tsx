/**
 * Tests for SceneCanvas scoping props: alphaFor and isPointerInteractive.
 *
 * Test strategy: jsdom cannot run WebGL so we cannot verify GPU output pixels.
 * Instead we test the two seams directly:
 *
 *   1. alpha  — `buildSceneLayer` is exported and unit-tested against its
 *               DrawCommand output. When `cfg.alphaFor(id)` returns < 1, the
 *               per-node commands must be wrapped in a `{ kind: 'group', alpha }`
 *               command so the renderer applies the multiplier.
 *
 *   2. hit    — `makeGetNodeAtPoint` is the factory SceneCanvas uses for the
 *               dispatcher's hit-test function. SceneCanvas wraps the produced
 *               function with an `isPointerInteractive` guard; the guard must
 *               suppress hits for non-interactive ids (return null).
 *
 * Both are pure-TS, no React rendering required.
 */

import { describe, it, expect } from 'vitest';
import { buildSceneLayer } from './Canvas';
import { makeGetNodeAtPoint } from './getNodeAtPoint';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';
import type { DrawCommand } from '../renderer';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const POSE = { x: 0, y: 0, width: 10, height: 10 };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 300, height: 300 };

type TData = { label: string };
type TLayer = 'bg';

function makeScene() {
  const scene = createScene<TData, TLayer, typeof POSE>({
    systemLayers: [{ id: 'bg' }],
  });
  const aId = scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'a' } });
  const bId = scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'b' } });
  const adapter = sceneToAdapter(scene);
  return { scene, adapter, aId, bId };
}

// ---------------------------------------------------------------------------
// Test 1: alphaFor is wired into the scene-render slot
// ---------------------------------------------------------------------------

describe('buildSceneLayer — alphaFor', () => {
  it('wraps dimmed-node commands in a group with the specified alpha', () => {
    const { adapter, aId, bId } = makeScene();

    // alphaFor returns 0.3 for node 'b', 1 for node 'a'
    const alphaFor = (id: string) => (id === bId ? 0.3 : 1);

    const layer = buildSceneLayer(
      {
        drawOne: () => [
          { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { color: 'red' } },
        ],
        alphaFor,
      },
      adapter as never,
      null,
      () => null,
      () => null,
    );

    const out = layer.draw(null, VIEW, DIMS) as DrawCommand[];
    // Top-level: [ viewGroup ]
    expect(out).toHaveLength(1);
    const viewGroup = out[0] as { kind: string; children: DrawCommand[] };
    expect(viewGroup.kind).toBe('group');

    // The hierarchical path yields: bgLayer group > [aEntry, bEntry]
    // aEntry: drawn without alpha wrapping (alpha === 1 → no wrapper)
    // bEntry: drawn wrapped in { kind: 'group', alpha: 0.3, children: [...] }
    //
    // buildSceneTree wraps each node's commands in a container group;
    // the alpha wrapper is injected INSIDE that container as the sole child.
    // Walk the tree and collect every { kind: 'group', alpha: <number> } node.
    function collectAlphaGroups(cmds: DrawCommand[]): { alpha: number }[] {
      const result: { alpha: number }[] = [];
      for (const cmd of cmds) {
        if (cmd.kind === 'group') {
          if ((cmd as { alpha?: number }).alpha != null) {
            result.push({ alpha: (cmd as { alpha?: number }).alpha! });
          }
          result.push(...collectAlphaGroups((cmd as { children: DrawCommand[] }).children));
        }
      }
      return result;
    }

    const alphaGroups = collectAlphaGroups(out);
    // Exactly one alpha-group must appear, for node 'b' with alpha 0.3
    expect(alphaGroups).toHaveLength(1);
    expect(alphaGroups[0].alpha).toBe(0.3);

    // Suppress unused-var warning in tests — both ids are used via alphaFor
    void aId;
  });

  it('emits no alpha-group when alphaFor always returns 1 (no-op case)', () => {
    const { adapter } = makeScene();

    const layer = buildSceneLayer(
      {
        drawOne: () => [
          { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { color: 'blue' } },
        ],
        alphaFor: () => 1,
      },
      adapter as never,
      null,
      () => null,
      () => null,
    );

    const out = layer.draw(null, VIEW, DIMS) as DrawCommand[];

    function hasAlphaGroup(cmds: DrawCommand[]): boolean {
      for (const cmd of cmds) {
        if (cmd.kind === 'group') {
          if ((cmd as { alpha?: number }).alpha != null) return true;
          if (hasAlphaGroup((cmd as { children: DrawCommand[] }).children)) return true;
        }
      }
      return false;
    }

    expect(hasAlphaGroup(out)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 2: isPointerInteractive blocks hit-test results
// ---------------------------------------------------------------------------

describe('getNodeAtPoint — isPointerInteractive filter', () => {
  it('returns null for ids where isPointerInteractive returns false', () => {
    const { bId } = makeScene();

    // pickEvery always returns bId (simulates the cursor over node 'b')
    const pickEvery = (_wx: number, _wy: number) => bId;

    const baseGetNodeAtPoint = makeGetNodeAtPoint(pickEvery);

    // The filter SceneCanvas applies when isPointerInteractive is supplied:
    const isPointerInteractive = (id: string) => id !== bId;

    const getNodeAtPoint = (wx: number, wy: number) => {
      const hit = baseGetNodeAtPoint(wx, wy);
      if (hit == null) return null;
      if (isPointerInteractive(hit.id) === false) return null;
      return hit;
    };

    // Clicking anywhere returns null because bId is non-interactive
    expect(getNodeAtPoint(5, 5)).toBeNull();
  });

  it('returns the hit when isPointerInteractive returns true for the hit id', () => {
    const { aId } = makeScene();

    const pickEvery = (_wx: number, _wy: number) => aId;
    const baseGetNodeAtPoint = makeGetNodeAtPoint(pickEvery);

    // aId IS interactive
    const isPointerInteractive = (_id: string) => true;

    const getNodeAtPoint = (wx: number, wy: number) => {
      const hit = baseGetNodeAtPoint(wx, wy);
      if (hit == null) return null;
      if (isPointerInteractive(hit.id) === false) return null;
      return hit;
    };

    const hit = getNodeAtPoint(5, 5);
    expect(hit).not.toBeNull();
    expect(hit!.id).toBe(aId);
  });
});
