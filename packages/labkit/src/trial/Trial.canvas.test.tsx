import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useContext } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { auto } from '../config/auto';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import type { LabStore } from '../state/store';

/** Waits one animation frame inside act, so what the frame loop sets commits there. */
const nextFrame = () => act(() => new Promise((r) => requestAnimationFrame(() => r(null))));

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

function makeInstrument(
  draw: (ctx: CanvasRenderingContext2D, args: unknown) => void,
  canvasExtra: Record<string, unknown> = {},
) {
  return defineInstrument<St, Record<string, never>>({
    name: 'Probe',
    defaultConfig: () => ({}),
    initialState: () => ({ n: 7 }),
    render: ({ state }) => <output data-testid="readout">n = {state.n}</output>,
    canvas: {
      initialView: { zoom: 2, pan: { x: 30, y: 40 } },
      layers: [{ id: 'main', draw }],
      ...canvasExtra,
    },
  });
}

describe('an instrument that draws', () => {
  it('still renders its own DOM, as an overlay over the canvas', async () => {
    const { container } = await renderSettled(
      <Lab instruments={[makeInstrument(() => undefined)]} defaultInstrument="Probe" />,
      { wrapper: withIcons },
    );
    expect(screen.getByTestId('readout')).toHaveTextContent('n = 7');
    expect(container.querySelector('.lk-canvas-stack__overlay')).toContainElement(
      screen.getByTestId('readout'),
    );
    expect(container.querySelectorAll('canvas').length).toBeGreaterThan(0);
  });

  it('draws with the camera applied, so world geometry lands where the view says', async () => {
    const draw = vi.fn();
    await renderSettled(<Lab instruments={[makeInstrument(draw)]} defaultInstrument="Probe" />, {
      wrapper: withIcons,
    });
    await nextFrame();

    expect(draw).toHaveBeenCalled();
    expect(ctxSpies.translate).toHaveBeenCalledWith(30, 40);
    expect(ctxSpies.scale).toHaveBeenCalledWith(2, 2);
  });

  it('passes zoom in the args so a layer can keep line widths unscaled', async () => {
    const draw = vi.fn();
    await renderSettled(<Lab instruments={[makeInstrument(draw)]} defaultInstrument="Probe" />, {
      wrapper: withIcons,
    });
    await nextFrame();

    expect(draw).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ zoom: 2, state: { n: 7 } }),
    );
  });
});

describe('two trials that draw', () => {
  it("leaves one trial's layers alone while the other's view changes", async () => {
    const draw = vi.fn();
    const seen: { lab: LabContextValue | null; store: LabStore | null } = {
      lab: null,
      store: null,
    };
    function Capture() {
      seen.lab = useContext(LabContext);
      seen.store = useContext(LabStoreContext)?.store ?? null;
      return null;
    }
    await renderSettled(
      <Lab instruments={[makeInstrument(draw)]} defaultInstrument="Probe">
        <Capture />
      </Lab>,
      { wrapper: withIcons },
    );
    await act(async () => seen.lab?.addTrial('Probe'));
    await nextFrame();
    const first = seen.lab?.trials[0]?.id ?? '';
    draw.mockClear();

    await act(async () =>
      seen.store?.getState().updateTrialView(first, { zoom: 3, pan: { x: 0, y: 0 } }),
    );
    await nextFrame();

    const zooms = draw.mock.calls.map(([, args]) => (args as { zoom: number }).zoom);
    expect(zooms).toEqual([3]);
  });
});

describe('an auto config path', () => {
  it('draws with the resolved value, which is what the panel shows too', async () => {
    const draw = vi.fn();
    const instrument = defineInstrument({
      name: 'Auto',
      config: f.schema({
        gap: f
          .number(12)
          .auto(() => 18)
          .range(0, 48)
          .initial(auto),
      }),
      initialState: () => ({ n: 0 }),
      render: () => null,
      canvas: { layers: [{ id: 'main', draw }] },
    });
    const { container } = await renderSettled(
      <Lab instruments={[instrument as Instrument]} defaultInstrument="Auto" />,
      { wrapper: withIcons },
    );
    await nextFrame();

    expect(draw).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ config: { gap: 18 } }),
    );
    // The panel is handed the raw config, but an auto row holds what the
    // resolver decided, so pinning it keeps the number the instrument drew.
    // The row hides its control while auto, which takes it out of the
    // accessibility tree — so this reads the element rather than the role.
    expect(container.querySelector('input[type=range]')).toHaveValue('18');
  });
});

describe('LabProps.instruments', () => {
  it('accepts a typed instrument with no cast', async () => {
    // The assignment is the assertion: this file fails to compile if
    // `defineInstrument<St, ...>`'s result stops being assignable.
    const typed = makeInstrument(() => undefined);
    await renderSettled(<Lab instruments={[typed]} defaultInstrument="Probe" />, {
      wrapper: withIcons,
    });
    expect(screen.getByTestId('readout')).toBeInTheDocument();
  });

  it('draws through a declared world spec, not the top-left default', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    } as unknown as DOMRect);
    ctxSpies.translate.mockClear();
    ctxSpies.scale.mockClear();

    const instrument = makeInstrument(vi.fn(), {
      worldSpec: { origin: { x: 0.5, y: 0.5 }, yAxis: 'up' },
    });
    await renderSettled(<Lab instruments={[instrument]} defaultInstrument="Probe" />, {
      wrapper: withIcons,
    });
    await nextFrame();

    // Origin (400,300) plus the instrument's pan (30,40); y runs up.
    expect(ctxSpies.translate).toHaveBeenCalledWith(430, 340);
    expect(ctxSpies.scale).toHaveBeenCalledWith(2, -2);
    vi.restoreAllMocks();
  });

  it('places a size-aware initial view once the canvas has been measured', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    } as unknown as DOMRect);
    ctxSpies.translate.mockClear();

    const instrument = makeInstrument(vi.fn(), {
      initialView: ({ width, height }: { width: number; height: number }) => ({
        zoom: 1,
        pan: { x: width / 4, y: height / 4 },
      }),
    });
    await renderSettled(<Lab instruments={[instrument]} defaultInstrument="Probe" />, {
      wrapper: withIcons,
    });
    await nextFrame();
    await nextFrame();

    expect(ctxSpies.translate).toHaveBeenCalledWith(200, 150);
    vi.restoreAllMocks();
  });

  it('tells the instrument which layers are currently visible', async () => {
    let seen: readonly string[] = [];
    const instrument = defineInstrument<St, Record<string, never>>({
      name: 'Probe',
      defaultConfig: () => ({}),
      initialState: () => ({ n: 1 }),
      render: ({ trial }) => {
        seen = trial.visibleLayers;
        return null;
      },
      canvas: {
        layers: [
          { id: 'grid', draw: () => undefined },
          { id: 'glyph', draw: () => undefined },
        ],
      },
      layers: { ids: ['grid', 'glyph'] },
    });
    await renderSettled(<Lab instruments={[instrument]} defaultInstrument="Probe" />, {
      wrapper: withIcons,
    });
    expect([...seen]).toEqual(['grid', 'glyph']);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Show grid' }));
    expect([...seen]).toEqual(['glyph']);
  });

  it('records an undo step on a layer toggle the instrument snapshots on', async () => {
    const instrument = defineInstrument<St, Record<string, never>>({
      name: 'Probe',
      defaultConfig: () => ({}),
      initialState: () => ({ n: 1 }),
      render: () => null,
      undo: { snapshotOn: ['layers.toggle'] },
      canvas: { layers: [{ id: 'grid', draw: () => undefined }] },
      layers: { ids: ['grid'] },
    });
    await renderSettled(<Lab instruments={[instrument]} defaultInstrument="Probe" />, {
      wrapper: withIcons,
    });
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Show grid' }));
    expect(undo).not.toBeDisabled();
  });
});
