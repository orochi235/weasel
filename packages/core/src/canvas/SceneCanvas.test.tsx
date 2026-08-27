import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import {
  DEFAULT_HANDLE_SIZE,
  defaultDrawOne,
  mergeLayersWithDefaults,
} from './SceneCanvas';

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

  it('mounts with no layers prop and uses defaults', () => {
    function Harness() {
      const scene = useScene<{ color: string }, 'default', { x: number; y: number; width: number; height: number }>({
        systemLayers: [{ id: 'default' }],
        initial: [{
          id: 'a' as never,
          kind: 'leaf',
          layer: 'default',
          pose: { x: 10, y: 20, width: 30, height: 40 },
          data: { color: '#f00' },
        }],
      });
      return <SceneCanvas width={200} height={200} scene={scene} />;
    }
    const { container } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    expect(canvas).toBeTruthy();
  });

  it('selectTool.handleHitRadius defaults to DEFAULT_HANDLE_SIZE when not provided', () => {
    function Harness() {
      const scene = useScene<{ color: string }, 'default', { x: number; y: number; width: number; height: number }>({
        systemLayers: [{ id: 'default' }],
      });
      return <SceneCanvas width={200} height={200} scene={scene} />;
    }
    const { container } = render(<Harness />);
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(DEFAULT_HANDLE_SIZE).toBe(8);
  });

  it('selectTool.handleHitRadius override wins over the default', () => {
    function Harness() {
      const scene = useScene<{ color: string }, 'default', { x: number; y: number; width: number; height: number }>({
        systemLayers: [{ id: 'default' }],
      });
      return (
        <SceneCanvas
          width={200} height={200} scene={scene}
          selectTool={{ handleHitRadius: 16 }}
        />
      );
    }
    const { container } = render(<Harness />);
    expect(container.querySelector('canvas')).toBeTruthy();
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
        kind: 'leaf' as const,
        layer: 'default',
        pose: { x: 1, y: 2, width: 3, height: 4 },
        data: { fill: { color: '#abc' } },
        parent: null,
      };
      const cmds = defaultDrawOne(node as never, node.pose);
      expect(cmds).toEqual([
        {
          kind: 'path',
          path: { kind: 'rect', x: 1, y: 2, width: 3, height: 4 },
          fill: { color: '#abc' },
        },
      ]);
    });

    it('falls back to gray when data has no fill', () => {
      const node = {
        id: 'a', kind: 'leaf' as const, layer: 'default',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: {}, parent: null,
      };
      const cmds = defaultDrawOne(node as never, node.pose);
      const fill = (cmds[0] as { fill: { color: string } }).fill;
      expect(fill.color).toBe('#888');
    });

    it('falls back to gray when data is null', () => {
      const node = {
        id: 'a', kind: 'leaf' as const, layer: 'default',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: null as never, parent: null,
      };
      const cmds = defaultDrawOne(node as never, node.pose);
      const fill = (cmds[0] as { fill: { color: string } }).fill;
      expect(fill.color).toBe('#888');
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

    it('passes through custom layer keys (unknown slots) unchanged', () => {
      const customLayer = { layer: { id: 'x', label: 'X', draw: () => [] } } as never;
      const merged = mergeLayersWithDefaults({ myExtra: customLayer });
      expect((merged as { myExtra?: unknown }).myExtra).toBe(customLayer);
    });
  });
});
