import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LensChrome } from './LensChrome';
import { LensSlot } from './LensSlot';
import type { LensSource, LensSourceRequest, LensSources } from './lensSource';
import { LENS_DEFAULTS, type LensIds, type LensSettings } from './lensTypes';
import { GRID_NEEDS } from './pixelGrid';

const IDS = { lensId: 'a', body: 'a:body', reticle: 'a:reticle', leader: 'a:leader' } as LensIds;
const SIZE = { width: 160, height: 160 };

function source(kind: 'live' | 'pixels') {
  const capture = vi.fn(async (_r: LensSourceRequest<string>) => ({
    reason: 'Nothing under the reticle',
  }));
  const s: LensSource<string> = {
    kind,
    produces: kind === 'pixels' ? 'pixels' : 'dom',
    label: () => kind,
    status: () => true,
    subscribe: () => () => {},
    attach: () => ({ update() {}, detach() {} }),
    ...(kind === 'pixels' ? { capture } : {}),
  };
  return { s, capture };
}

function mount(patch: Partial<LensSettings<string>>, sources: LensSources<string>) {
  const props = {
    lens: IDS,
    settings: { ...LENS_DEFAULTS, ...patch },
    sources,
    reticle: { x: 10, y: 20 },
    size: SIZE,
    describe: String,
  };
  render(
    <>
      <div data-testid="slot">
        <LensSlot {...props} />
      </div>
      <div data-testid="chrome">
        <LensChrome {...props} />
      </div>
    </>,
  );
}

const grids = () => screen.getByTestId('slot').querySelectorAll('canvas.lk-lens-grid');
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

describe('the Pixel grid canvas', () => {
  it('mounts over a Pixels lens at 8× and asks the source for the capture the cell shows', async () => {
    const pixels = source('pixels');
    mount({ source: 'pixels', factor: 8, readouts: ['grid'] }, { pixels: pixels.s });
    await settle();
    expect(grids()).toHaveLength(1);
    expect(pixels.capture).toHaveBeenCalledTimes(1);
    expect(pixels.capture.mock.calls[0]?.[0]).toMatchObject({
      factor: 8,
      dpr: 1,
      conditions: null,
    });
  });

  it('is not mounted until the lens has switched it on', () => {
    mount({ source: 'pixels', factor: 8, readouts: [] }, { pixels: source('pixels').s });
    expect(grids()).toHaveLength(0);
  });

  it('is not mounted below 8× a captured pixel, however high the factor over a denser capture', () => {
    mount(
      { source: 'pixels', factor: 12, dprs: [2], readouts: ['grid'] },
      { pixels: source('pixels').s },
    );
    expect(grids()).toHaveLength(0);
  });

  it('is not mounted over a Live lens, which has no pixels to draw between', () => {
    mount({ source: 'live', factor: 16, readouts: ['grid'] }, { live: source('live').s });
    expect(grids()).toHaveLength(0);
  });

  it('has its toggle say what it needs when it is on and cannot draw', () => {
    mount({ source: 'live', factor: 16, readouts: ['grid'] }, { live: source('live').s });
    expect(screen.getByTestId('chrome').textContent).toContain(GRID_NEEDS);
    expect(GRID_NEEDS).toBe('Grid needs Pixels at 8× per captured pixel (zoom ÷ DPR)');
  });

  it('keeps its plain label while it draws, and while it is off', () => {
    mount({ source: 'pixels', factor: 8, readouts: ['grid'] }, { pixels: source('pixels').s });
    expect(screen.getByRole('button', { name: 'Grid' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Contrast' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.getByTestId('chrome').textContent).not.toContain(GRID_NEEDS);
  });
});
