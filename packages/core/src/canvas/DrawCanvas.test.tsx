/**
 * `<DrawCanvas>` against a mocked `WeaselRenderer`: what it hands the renderer,
 * when it repaints, and that unmount frees the GL objects. Real pixels are
 * `DrawCanvas.browser.test.tsx`'s job.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { registerPaintKind, getPaintKind } from 'core/paintKinds';
import type { DrawCommand, GroupDrawCommand } from '../renderer/DrawCommand';
import { DrawCanvas } from './DrawCanvas';

const renderMock = vi.fn<(commands: DrawCommand[]) => void>();
const resizeMock = vi.fn<(dims: { width: number; height: number; dpr: number }) => void>();
const ctorSpy = vi.fn<(opts: { width: number; height: number; dpr: number }) => void>();
const disposeMock = vi.fn();

vi.mock('../renderer/WeaselRenderer', () => ({
  WeaselRenderer: class {
    constructor(opts: { width: number; height: number; dpr: number }) { ctorSpy(opts); }
    render(commands: DrawCommand[]): void { renderMock(commands); }
    resize(dims: { width: number; height: number; dpr: number }): void { resizeMock(dims); }
    dispose(): void { disposeMock(); }
  },
}));

beforeEach(() => {
  renderMock.mockClear();
  resizeMock.mockClear();
  ctorSpy.mockClear();
  disposeMock.mockClear();
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true, writable: true });
  const fakeGl = { enable: () => {} } as unknown as WebGL2RenderingContext;
  HTMLCanvasElement.prototype.getContext = (function (this: HTMLCanvasElement, kind: string) {
    return kind === 'webgl2' ? fakeGl : null;
  }) as HTMLCanvasElement['getContext'];
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

const rect = (color: string): DrawCommand => ({
  kind: 'path',
  path: { kind: 'rect', x: 1, y: 2, width: 3, height: 4 },
  fill: { fill: 'solid', color },
});

const lastFrame = () => renderMock.mock.calls.at(-1)![0];
const content = (commands: DrawCommand[]) => (commands.at(-1) as GroupDrawCommand).children;

describe('<DrawCanvas>', () => {
  it('paints its commands on mount, at the device pixel ratio', () => {
    render(<DrawCanvas width={40} height={20} draw={[rect('#f00')]} />);
    expect(ctorSpy).toHaveBeenCalledWith(expect.objectContaining({ width: 40, height: 20, dpr: 2 }));
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(content(lastFrame())).toEqual([rect('#f00')]);
  });

  it('puts the background beneath the view, covering the whole surface', () => {
    render(
      <DrawCanvas
        width={40} height={20} background={{ fill: 'solid', color: '#fff' }}
        view={{ x: 5, y: 0, scale: { x: 2, y: 2 } }} draw={[rect('#f00')]}
      />,
    );
    const [bg, group] = lastFrame();
    expect(bg).toEqual({
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 40, height: 20 },
      fill: { fill: 'solid', color: '#fff' },
    });
    expect(Array.from((group as GroupDrawCommand).transform!)).toEqual([2, 0, 0, 0, 2, 0, -10, 0, 1]);
  });

  it('repaints on the next frame when its commands change', async () => {
    const { rerender } = render(<DrawCanvas width={40} height={20} draw={[rect('#f00')]} />);
    rerender(<DrawCanvas width={40} height={20} draw={[rect('#00f')]} />);
    await act(frame);
    expect(content(lastFrame())).toEqual([rect('#00f')]);
  });

  it('calls a draw callback at paint time with the surface size', () => {
    const draw = vi.fn(() => [rect('#0f0')]);
    render(<DrawCanvas width={40} height={20} draw={draw} />);
    expect(draw).toHaveBeenCalledWith({ width: 40, height: 20 });
    expect(content(lastFrame())).toEqual([rect('#0f0')]);
  });

  it('repaints when a redrawOn source notifies', async () => {
    let notify = () => {};
    const source = { subscribe: (fn: () => void) => { notify = fn; return () => {}; } };
    let color = '#f00';
    render(<DrawCanvas width={40} height={20} draw={() => [rect(color)]} redrawOn={[source]} />);
    await act(frame);
    color = '#00f';
    act(() => notify());
    await act(frame);
    expect(content(lastFrame())).toEqual([rect('#00f')]);
  });

  it('repaints when a paint kind registers late', async () => {
    render(<DrawCanvas width={40} height={20} draw={[rect('#f00')]} />);
    await act(frame);
    const before = renderMock.mock.calls.length;
    const off = registerPaintKind({ ...getPaintKind('solid')!, id: 'draw-canvas-late' });
    off();
    await act(frame);
    expect(renderMock.mock.calls.length).toBeGreaterThan(before);
  });

  it('resizes the renderer when its size changes', async () => {
    const { rerender } = render(<DrawCanvas width={40} height={20} draw={[]} />);
    rerender(<DrawCanvas width={80} height={20} draw={[]} />);
    await act(frame);
    expect(resizeMock).toHaveBeenCalledWith({ width: 80, height: 20, dpr: 2 });
  });

  it('frees its renderer on unmount', () => {
    const { unmount } = render(<DrawCanvas width={40} height={20} draw={[]} />);
    unmount();
    expect(disposeMock).toHaveBeenCalledTimes(1);
  });
});
