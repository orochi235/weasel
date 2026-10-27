/**
 * Aims through the surface's handle: the root view's and a mounted view's,
 * answered and written.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { CanvasView } from './CanvasView';
import { createScene } from 'core/scene/scene';
import { rectAim } from 'domains/viewports/aim';
import type { SceneCanvasApi } from './canvasExtension';
import type { View } from 'core/viewport/view';

type D = { kind: 'rect' };
type P = { x: number; y: number; width: number; height: number };

const ROOT: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

const widthDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const heightDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 400 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 });
});
afterAll(() => {
  if (widthDesc) Object.defineProperty(HTMLElement.prototype, 'clientWidth', widthDesc);
  if (heightDesc) Object.defineProperty(HTMLElement.prototype, 'clientHeight', heightDesc);
});

let api: RefObject<SceneCanvasApi | null>;
let onViewChange: ReturnType<typeof vi.fn<(v: View) => void>>;

beforeEach(() => {
  api = createRef<SceneCanvasApi>();
  onViewChange = vi.fn<(v: View) => void>();
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  render(
    <SceneCanvas scene={scene} layers={{}} width={400} height={300} view={ROOT} onViewChange={onViewChange} ref={api}>
      <CanvasView id="pip" bounds={{ x: 250, y: 180, w: 140, h: 105 }} defaultView={{ x: 0, y: 0, scale: { x: 0.25, y: 0.25 } }} />
    </SceneCanvas>,
  );
});

describe('SceneCanvas aims', () => {
  it("answers the root view's aim", () => {
    expect(api.current!.aimOf(null)!.extent).toEqual({ x: 0, y: 0, width: 400, height: 300 });
    expect(api.current!.aimOf(null)!.viewId).toBeNull();
  });

  it("answers a view's aim, and null for no such view", () => {
    expect(api.current!.aimOf('pip')!.extent).toEqual({ x: 0, y: 0, width: 560, height: 420 });
    expect(api.current!.aimOf('nope')).toBeNull();
  });

  it('writes the root aim through onViewChange', () => {
    act(() => { api.current!.setAim(null, rectAim(null, { x: 40, y: 40, width: 400, height: 300 })); });
    expect(onViewChange).toHaveBeenLastCalledWith({ x: 40, y: 40, scale: { x: 1, y: 1 } });
  });
});
