import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { KitSettingsProvider } from '@weasel-js/react';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import { createScene } from 'core/scene/scene';
import {
  DEFAULT_HANDLE_SIZE,
  defaultDrawOne,
  mergeLayersWithDefaults,
} from './SceneCanvas';
import { defaultPaintBounds } from './defaultDrawOne';
import { layersOverPresets } from './SceneCanvas/mergeLayers';

// jsdom doesn't implement getContext or pointer capture; stub minimally.
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => {
    return {
      canvas: { width: 0, height: 0 },
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      setTransform: vi.fn(),
      scale: vi.fn(),
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      font: '',
      textBaseline: '',
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;
  });
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

describe('SceneCanvas', () => {
  it('renders a canvas', () => {
    function Demo() {
      const scene = useScene<{ id: string }>({ items: [] });
      return <SceneCanvas scene={scene} width={64} height={64} layers={{}} />;
    }
    const { container } = render(<Demo />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('selectTool.handleHitRadius widens the corner handle past the default radius', () => {
    type Pose = { x: number; y: number; width: number; height: number };
    const START: Pose = { x: 100, y: 100, width: 80, height: 60 };
    // Presses 12px left of the top-left corner and drags it out by 20px.
    function dragNearCorner(handleHitRadius?: number): Pose {
      const scene = createScene<{ kind: 'rect' }, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
      const id = scene.add({ kind: 'mark', layer: 'main', pose: START, data: { kind: 'rect' } });
      scene.setSelection([id]);
      const { container, unmount } = render(
        <SceneCanvas
          features={['pick', 'resize']} width={400} height={400} scene={scene}
          {...(handleHitRadius === undefined ? {} : { selectTool: { handleHitRadius } })}
        />,
      );
      const canvas = container.querySelector('canvas')!;
      const fire = (type: string, x: number, y: number) =>
        canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
      act(() => {
        fire('pointerdown', 88, 100);
        fire('pointermove', 68, 80);
        fire('pointerup', 68, 80);
      });
      const pose = scene.get(id)!.pose;
      unmount();
      return pose;
    }

    expect(dragNearCorner()).toEqual(START);
    expect(dragNearCorner(16)).toEqual({ x: 80, y: 80, width: 100, height: 80 });
  });

  it('targets.handlePx widens the corner handle, and selectTool.handleHitRadius wins over it', () => {
    type Pose = { x: number; y: number; width: number; height: number };
    const START: Pose = { x: 100, y: 100, width: 80, height: 60 };
    function dragNearCorner(handlePx: number, handleHitRadius?: number): Pose {
      const scene = createScene<{ kind: 'rect' }, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
      const id = scene.add({ kind: 'mark', layer: 'main', pose: START, data: { kind: 'rect' } });
      scene.setSelection([id]);
      const { container, unmount } = render(
        <KitSettingsProvider value={{ targets: { handlePx } }}>
          <SceneCanvas
            features={['pick', 'resize']} width={400} height={400} scene={scene}
            {...(handleHitRadius === undefined ? {} : { selectTool: { handleHitRadius } })}
          />
        </KitSettingsProvider>,
      );
      const canvas = container.querySelector('canvas')!;
      const fire = (type: string, x: number, y: number) =>
        canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
      act(() => {
        fire('pointerdown', 88, 100);
        fire('pointermove', 68, 80);
        fire('pointerup', 68, 80);
      });
      const pose = scene.get(id)!.pose;
      unmount();
      return pose;
    }

    expect(dragNearCorner(16)).toEqual({ x: 80, y: 80, width: 100, height: 80 });
    expect(dragNearCorner(16, 6)).toEqual(START);
  });
});

describe('SceneCanvas defaults', () => {
  describe('DEFAULT_HANDLE_SIZE', () => {
    it('is 8 (the demo-wide HANDLE constant)', () => {
      expect(DEFAULT_HANDLE_SIZE).toBe(8);
    });
  });

  describe('defaultDrawOne', () => {
    it('emits a filled rect using node.data.fill', () => {
      const node = {
        id: 'a',
        kind: 'mark' as const,
        layer: 'default',
        pose: { x: 1, y: 2, width: 3, height: 4 },
        data: { fill: { paint: { color: '#abc' } } },
        parent: null,
      };
      const cmds = defaultDrawOne(node as never, node.pose);
      expect(cmds).toEqual([
        {
          kind: 'path',
          path: { kind: 'rect', x: 1, y: 2, width: 3, height: 4 },
          fill: { paint: { color: '#abc' } },
        },
      ]);
    });

    it('paints no fill when data has no fill', () => {
      const node = {
        id: 'a', kind: 'mark' as const, layer: 'default',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: {}, parent: null,
      };
      const cmds = defaultDrawOne(node as never, node.pose);
      expect((cmds[0] as { fill?: unknown }).fill).toBeUndefined();
    });

    it('paints no fill when data is null', () => {
      const node = {
        id: 'a', kind: 'mark' as const, layer: 'default',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: null as never, parent: null,
      };
      const cmds = defaultDrawOne(node as never, node.pose);
      expect((cmds[0] as { fill?: unknown }).fill).toBeUndefined();
    });
  });

  describe('mergeLayersWithDefaults', () => {
    it('returns full defaults when input is undefined', () => {
      const merged = mergeLayersWithDefaults(undefined);
      expect(merged.scene).toBeDefined();
      expect((merged.scene as { drawOne: unknown }).drawOne).toBe(defaultDrawOne);
      expect(merged.selectionOverlay).toEqual({ handles: { size: DEFAULT_HANDLE_SIZE } });
    });

    it('returns full defaults when input is empty', () => {
      const merged = mergeLayersWithDefaults({});
      expect((merged.scene as { drawOne: unknown }).drawOne).toBe(defaultDrawOne);
      expect(merged.selectionOverlay).toEqual({ handles: { size: DEFAULT_HANDLE_SIZE } });
    });

    it('partial slot config spreads on top of the default for that slot', () => {
      const customDrawOne = () => [];
      const merged = mergeLayersWithDefaults({
        scene: { drawOne: customDrawOne as never },
      });
      expect((merged.scene as { drawOne: unknown }).drawOne).toBe(customDrawOne);
      expect(merged.selectionOverlay).toEqual({ handles: { size: DEFAULT_HANDLE_SIZE } });
    });

    it('leaves a pre-built layer in either slot as it was given', () => {
      const layer = { id: 'mine', label: 'Mine', draw: () => [] };
      const merged = mergeLayersWithDefaults({ scene: { layer }, selectionOverlay: { layer } });
      expect(merged.scene).toEqual({ layer });
      expect(merged.selectionOverlay).toEqual({ layer });
    });

    it('a scene slot without drawOne keeps the default painter', () => {
      const merged = mergeLayersWithDefaults({ scene: { cull: true } });
      expect(merged.scene).toMatchObject({ drawOne: defaultDrawOne, cull: true });
    });

    it('bounds the default painter for culling, and nothing a custom drawOne paints', () => {
      expect(mergeLayersWithDefaults({ scene: { cull: true } }).scene)
        .toMatchObject({ paintBounds: defaultPaintBounds });
      expect(mergeLayersWithDefaults({ scene: { drawOne: defaultDrawOne as never } }).scene)
        .toMatchObject({ paintBounds: defaultPaintBounds });
      const custom = mergeLayersWithDefaults({ scene: { drawOne: (() => []) as never } }).scene;
      expect((custom as { paintBounds?: unknown }).paintBounds).toBeUndefined();
      const own = () => null;
      expect(mergeLayersWithDefaults({ scene: { drawOne: (() => []) as never, paintBounds: own } }).scene)
        .toMatchObject({ paintBounds: own });
    });

    it('null slot suppresses the default', () => {
      const merged = mergeLayersWithDefaults({ selectionOverlay: null });
      expect(merged.selectionOverlay).toBeNull();
      expect((merged.scene as { drawOne: unknown }).drawOne).toBe(defaultDrawOne);
    });

    it('null scene + null overlay yields a layers map with both nulls', () => {
      const merged = mergeLayersWithDefaults({ scene: null, selectionOverlay: null });
      expect(merged.scene).toBeNull();
      expect(merged.selectionOverlay).toBeNull();
    });

    it('lays the consumer\'s layers over the presets\', null included', () => {
      const layer = (id: string) => ({ layer: { id, label: id, draw: () => [] } });
      const presets = { grid: layer('preset-grid'), ruler: layer('preset-ruler') };
      expect(layersOverPresets({}, undefined)).toBeUndefined();
      expect(layersOverPresets(presets, undefined)).toEqual(presets);
      const mine = layer('mine');
      expect(layersOverPresets(presets, { grid: mine })).toEqual({ grid: mine, ruler: presets.ruler });
      expect(layersOverPresets(presets, { grid: null })).toEqual({ grid: null, ruler: presets.ruler });
    });

    it('passes through custom layer keys (unknown slots) unchanged', () => {
      const customLayer = { layer: { id: 'x', label: 'X', draw: () => [] } } as never;
      const merged = mergeLayersWithDefaults({ myExtra: customLayer });
      expect((merged as { myExtra?: unknown }).myExtra).toBe(customLayer);
    });
  });
});
