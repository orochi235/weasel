import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { SwillustratorDemo } from '../../../demo/demos/SwillustratorDemo';

// Latest 2D context handed out by getContext — tests inspect spies on it
// after driving pointer events through the demo.
let latestCtx: ReturnType<typeof makeCtx> | null = null;

function makeCtx() {
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
    measureText: vi.fn(() => ({ width: 0 })),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textBaseline: '',
    textAlign: '',
  };
}

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => {
    latestCtx = makeCtx();
    return latestCtx as unknown as CanvasRenderingContext2D;
  });
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

describe('SwillustratorDemo', () => {
  it('renders the five tool buttons and a canvas', () => {
    const { container, getByText } = render(<SwillustratorDemo />);
    expect(getByText(/Select/)).toBeTruthy();
    expect(getByText(/Rect/)).toBeTruthy();
    expect(getByText(/Text/)).toBeTruthy();
    expect(getByText(/Pen/)).toBeTruthy();
    expect(getByText(/Hand/)).toBeTruthy();
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('clicking a palette button switches the active tool indicator', () => {
    const { getByText, container } = render(<SwillustratorDemo />);
    // Initial active tool is "select".
    expect(container.textContent).toContain('tool: select');
    act(() => { fireEvent.click(getByText(/Rect/)); });
    expect(container.textContent).toContain('tool: insert');
    act(() => { fireEvent.click(getByText(/Text/)); });
    expect(container.textContent).toContain('tool: text');
    act(() => { fireEvent.click(getByText(/Pen/)); });
    expect(container.textContent).toContain('tool: pen');
    act(() => { fireEvent.click(getByText(/Hand/)); });
    expect(container.textContent).toContain('tool: hand');
  });

  it('insert tool draws an overlay rect mid-drag (new overlay channel)', () => {
    const { container, getByText } = render(<SwillustratorDemo />);
    act(() => { fireEvent.click(getByText(/Rect/)); });
    const canvas = container.querySelector('canvas')!;
    // Reset call counts so we measure paint triggered by the drag, not initial.
    latestCtx!.fillRect.mockClear();
    latestCtx!.strokeRect.mockClear();
    act(() => {
      fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50, pointerId: 1, button: 0 });
      fireEvent.pointerMove(canvas, { clientX: 150, clientY: 100, pointerId: 1 });
    });
    // Insert overlay paints a filled + stroked rect.
    expect(latestCtx!.fillRect).toHaveBeenCalled();
    expect(latestCtx!.strokeRect).toHaveBeenCalled();
    expect(latestCtx!.setLineDash).toHaveBeenCalled();
  });

  it('select tool draws an area-select marquee mid-drag in empty space', () => {
    const { container } = render(<SwillustratorDemo />);
    // Default tool is select; drag from clearly-empty space.
    const canvas = container.querySelector('canvas')!;
    latestCtx!.fillRect.mockClear();
    latestCtx!.strokeRect.mockClear();
    latestCtx!.setLineDash.mockClear();
    act(() => {
      fireEvent.pointerDown(canvas, { clientX: 480, clientY: 320, pointerId: 1, button: 0 });
      fireEvent.pointerMove(canvas, { clientX: 560, clientY: 380, pointerId: 1 });
    });
    expect(latestCtx!.fillRect).toHaveBeenCalled();
    expect(latestCtx!.strokeRect).toHaveBeenCalled();
    expect(latestCtx!.setLineDash).toHaveBeenCalled();
  });

  it('keyboard shortcuts switch tools (T → text, P → pen, H → hand, V → select)', () => {
    const { container } = render(<SwillustratorDemo />);
    act(() => { fireEvent.keyDown(document, { key: 'T' }); });
    expect(container.textContent).toContain('tool: text');
    act(() => { fireEvent.keyDown(document, { key: 'P' }); });
    expect(container.textContent).toContain('tool: pen');
    act(() => { fireEvent.keyDown(document, { key: 'H' }); });
    expect(container.textContent).toContain('tool: hand');
    act(() => { fireEvent.keyDown(document, { key: 'V' }); });
    expect(container.textContent).toContain('tool: select');
  });
});
