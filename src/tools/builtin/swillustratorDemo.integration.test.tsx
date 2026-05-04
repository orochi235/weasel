import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { SwillustratorDemo } from '../../../demo/demos/SwillustratorDemo';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => ({
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
  } as unknown as CanvasRenderingContext2D));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

describe('SwillustratorDemo', () => {
  it('renders the four tool buttons and a canvas', () => {
    const { container, getByText } = render(<SwillustratorDemo />);
    expect(getByText(/Select/)).toBeTruthy();
    expect(getByText(/Rect/)).toBeTruthy();
    expect(getByText(/Text/)).toBeTruthy();
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
    act(() => { fireEvent.click(getByText(/Hand/)); });
    expect(container.textContent).toContain('tool: hand');
  });

  it('keyboard shortcuts switch tools (T → text, H → hand, V → select)', () => {
    const { container } = render(<SwillustratorDemo />);
    act(() => { fireEvent.keyDown(document, { key: 'T' }); });
    expect(container.textContent).toContain('tool: text');
    act(() => { fireEvent.keyDown(document, { key: 'H' }); });
    expect(container.textContent).toContain('tool: hand');
    act(() => { fireEvent.keyDown(document, { key: 'V' }); });
    expect(container.textContent).toContain('tool: select');
  });
});
