import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    getImageData: () => ({ data: Uint8ClampedArray.from([0, 0, 0, 0]) }),
  })) as unknown as HTMLCanvasElement['getContext'];
});

const canvasInstrument = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Drawn',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
  canvas: { layers: [{ id: 'main', draw: () => undefined }] },
  loupe: true,
});

const domInstrument = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Written',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <p data-testid="body">the content</p>,
  loupe: { render: ({ view }) => <p data-testid="lens-body">zoom {view.zoom}</p> },
});

const noLoupe = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Plain',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
  canvas: { layers: [{ id: 'main', draw: () => undefined }] },
});

const lens = (c: HTMLElement): Element | null => c.querySelector('.lk-loupe');

/** jsdom lays nothing out, so a client coordinate is already host-relative. */
function pointAt(host: Element, x: number, y: number): void {
  fireEvent.pointerMove(host, { clientX: x, clientY: y });
}

describe('the loupe capability', () => {
  it('gives a trial a toolbar toggle, and no lens until it is on', () => {
    const { container } = render(
      <Lab instruments={[canvasInstrument]} defaultInstrument="Drawn" />,
    );
    expect(screen.getByRole('button', { name: 'Loupe' })).toHaveAttribute('aria-pressed', 'false');
    expect(lens(container)).toBeNull();
  });

  it('offers nothing to an instrument that declares none', () => {
    render(<Lab instruments={[noLoupe]} defaultInstrument="Plain" />);
    expect(screen.queryByRole('button', { name: 'Loupe' })).toBeNull();
  });

  it('drops out of a trial that suppresses it', () => {
    render(<Lab instruments={[canvasInstrument]} defaultInstrument="Drawn" suppress={['loupe']} />);
    expect(screen.queryByRole('button', { name: 'Loupe' })).toBeNull();
  });

  it('raises the lens over a canvas stack once it is on and aimed', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Lab instruments={[canvasInstrument]} defaultInstrument="Drawn" />,
    );
    await user.click(screen.getByRole('button', { name: 'Loupe' }));
    expect(screen.getByRole('button', { name: 'Loupe' })).toHaveAttribute('aria-pressed', 'true');

    const stack = container.querySelector('.lk-canvas-stack');
    if (!stack) throw new Error('no canvas stack');
    pointAt(stack, 60, 40);

    const bubble = lens(container);
    expect(bubble).not.toBeNull();
    // The lens is drawn inside the stack's overlay, so it moves with the canvas
    // rather than with the page.
    expect(container.querySelector('.lk-canvas-stack__overlay')).toContainElement(
      bubble as HTMLElement,
    );
    expect(bubble?.querySelector('canvas')).not.toBeNull();
  });

  it('asks a DOM instrument to draw itself again at the magnified camera', async () => {
    const user = userEvent.setup();
    const { container } = render(<Lab instruments={[domInstrument]} defaultInstrument="Written" />);
    await user.click(screen.getByRole('button', { name: 'Loupe' }));

    const host = container.querySelector('.lk-trial__loupe-host');
    if (!host) throw new Error('no loupe host');
    pointAt(host, 60, 40);

    // The trial opens at zoom 1 and the loupe at factor 6.
    expect(screen.getByTestId('lens-body')).toHaveTextContent('zoom 6');
    // The instrument's own body is still there, undisturbed.
    expect(screen.getByTestId('body')).toBeInTheDocument();
  });

  it('wraps a DOM instrument only when it declares a loupe', () => {
    const { container } = render(<Lab instruments={[noLoupe]} defaultInstrument="Plain" />);
    expect(container.querySelector('.lk-trial__loupe-host')).toBeNull();
  });

  it('puts the lens away again when the toggle goes off', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Lab instruments={[canvasInstrument]} defaultInstrument="Drawn" />,
    );
    const toggle = screen.getByRole('button', { name: 'Loupe' });
    await user.click(toggle);
    const stack = container.querySelector('.lk-canvas-stack');
    if (!stack) throw new Error('no canvas stack');
    pointAt(stack, 60, 40);
    expect(lens(container)).not.toBeNull();

    await user.click(toggle);
    expect(lens(container)).toBeNull();
  });
});
