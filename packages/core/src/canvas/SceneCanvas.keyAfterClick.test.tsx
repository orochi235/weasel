import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { NodeId, Scene } from 'core/scene/types';
import { useSelection } from '../core/selection/useSelection';

type D = { kind: string };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
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
});

function setup(mode: 'single' | 'multi') {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  let a = '' as NodeId;
  let b = '' as NodeId;
  scene.batch('seed', () => {
    a = scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 100, y: 100, width: 80, height: 60 } });
    b = scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 250, y: 250, width: 80, height: 60 } });
  });
  function Harness() {
    const selection = useSelection({ scene, mode });
    return <SceneCanvas features={['select', 'delete']} scene={scene} selection={selection} layers={{}} width={400} height={400} />;
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  const pointer = (type: 'pointerdown' | 'pointerup', x: number, y: number) => {
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: type === 'pointerdown' ? 1 : 0, isPrimary: true }));
  };
  const backspace = () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })); };
  const has = (id: NodeId) => (scene as Scene<D, L, P>).get(id) !== undefined;
  return { a, b, pointer, backspace, has, scene };
}

// Each key is sent in the same task as the click, before React has rendered
// anything the press changed, so it can only act on what the click selected
// if the selection is read where the press wrote it.
describe('a key pressed straight after a click', () => {
  it('deletes nothing with nothing clicked', () => {
    const { a, b, backspace, has } = setup('multi');
    act(backspace);
    expect(has(a)).toBe(true);
    expect(has(b)).toBe(true);
  });

  it.each(['single', 'multi'] as const)('acts on the node the click selected (%s)', (mode) => {
    const { a, b, pointer, backspace, has } = setup(mode);
    act(() => {
      pointer('pointerdown', 140, 130);
      pointer('pointerup', 140, 130);
      backspace();
    });
    expect(has(a)).toBe(false);
    expect(has(b)).toBe(true);
  });

  it('acts on the node pressed, when it comes before the release', () => {
    const { a, b, pointer, backspace, has } = setup('multi');
    act(() => {
      pointer('pointerdown', 140, 130);
      backspace();
      pointer('pointerup', 140, 130);
    });
    expect(has(a)).toBe(false);
    expect(has(b)).toBe(true);
  });

  it('acts on the newly clicked node, not the one selected before', () => {
    const { a, b, pointer, backspace, has } = setup('multi');
    act(() => { pointer('pointerdown', 290, 280); pointer('pointerup', 290, 280); });
    act(() => {
      pointer('pointerdown', 140, 130);
      pointer('pointerup', 140, 130);
      backspace();
    });
    expect(has(a)).toBe(false);
    expect(has(b)).toBe(true);
  });

  it('acts on the one node a click inside a multi-selection collapses it to on release', () => {
    const { a, b, pointer, backspace, has, scene } = setup('multi');
    act(() => { scene.setSelection([a, b]); });
    act(() => {
      pointer('pointerdown', 140, 130);
      pointer('pointerup', 140, 130);
      backspace();
    });
    expect(has(a)).toBe(false);
    expect(has(b)).toBe(true);
  });
});
