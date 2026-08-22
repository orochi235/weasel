import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

interface St {
  n: number;
}

const ctxSpies = {
  save: vi.fn(),
  restore: vi.fn(),
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
};

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ctxSpies,
  ) as unknown as HTMLCanvasElement['getContext'];
});

function makeInstrument(draw: (ctx: CanvasRenderingContext2D, args: unknown) => void) {
  return defineInstrument<St, Record<string, never>>({
    name: 'Probe',
    defaultConfig: () => ({}),
    initialState: () => ({ n: 7 }),
    render: ({ state }) => <output data-testid="readout">n = {state.n}</output>,
    canvas: {
      initialView: { zoom: 2, pan: { x: 30, y: 40 } },
      layers: [{ id: 'main', draw }],
    },
  });
}

describe('an instrument that draws', () => {
  it('still renders its own DOM, as an overlay over the canvas', () => {
    const { container } = render(
      <Lab instruments={[makeInstrument(() => undefined)]} defaultInstrument="Probe" />,
    );
    expect(screen.getByTestId('readout')).toHaveTextContent('n = 7');
    expect(container.querySelector('.lk-canvas-stack__overlay')).toContainElement(
      screen.getByTestId('readout'),
    );
    expect(container.querySelectorAll('canvas').length).toBeGreaterThan(0);
  });

  it('draws with the camera applied, so world geometry lands where the view says', async () => {
    const draw = vi.fn();
    render(<Lab instruments={[makeInstrument(draw)]} defaultInstrument="Probe" />);
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    expect(draw).toHaveBeenCalled();
    expect(ctxSpies.translate).toHaveBeenCalledWith(30, 40);
    expect(ctxSpies.scale).toHaveBeenCalledWith(2, 2);
  });

  it('passes zoom in the args so a layer can keep line widths unscaled', async () => {
    const draw = vi.fn();
    render(<Lab instruments={[makeInstrument(draw)]} defaultInstrument="Probe" />);
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    expect(draw).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ zoom: 2, state: { n: 7 } }),
    );
  });
});

describe('LabProps.instruments', () => {
  it('accepts a typed instrument with no cast', () => {
    // The assignment is the assertion: this file fails to compile if
    // `defineInstrument<St, ...>`'s result stops being assignable.
    const typed = makeInstrument(() => undefined);
    render(<Lab instruments={[typed]} defaultInstrument="Probe" />);
    expect(screen.getByTestId('readout')).toBeInTheDocument();
  });
});
