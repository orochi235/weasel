import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { type Action, ActionsProvider, useActionsRegistry } from '@weasel-js/core';
import { StrictMode, useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LensChrome } from './LensChrome';
import { LensSlot } from './LensSlot';
import {
  type LensSource,
  type LensSourceRequest,
  type LensSources,
  type LensSourceStatus,
} from './lensSource';
import { LENS_DEFAULTS, type LensIds, type LensSettings, type LoupePoint } from './lensTypes';

const IDS = { lensId: 'a', body: 'a:body', reticle: 'a:reticle', leader: 'a:leader' } as LensIds;
const SIZE = { width: 160, height: 160 };

function fakeSource(
  kind: 'live' | 'pixels',
  over: { status?: LensSourceStatus; label?: (r: LensSourceRequest<string>) => string } = {},
) {
  const update = vi.fn();
  const detach = vi.fn();
  let status: LensSourceStatus = over.status ?? true;
  const listeners = new Set<() => void>();
  const attach = vi.fn((_slot: HTMLElement, _r: LensSourceRequest<string>) => ({
    update,
    detach,
  }));
  const source: LensSource<string> = {
    kind,
    produces: kind === 'pixels' ? 'pixels' : 'dom',
    label: over.label ?? (() => (kind === 'live' ? 'Live' : 'Pixels')),
    status: () => status,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    attach,
  };
  return {
    source,
    attach,
    update,
    detach,
    setStatus(next: LensSourceStatus) {
      status = next;
      for (const l of listeners) l();
    },
  };
}

function settings(patch: Partial<LensSettings<string>> = {}): LensSettings<string> {
  return { ...LENS_DEFAULTS, ...patch };
}

function Both(props: {
  settings: LensSettings<string>;
  sources: LensSources<string>;
  reticle?: LoupePoint;
}) {
  const shared = {
    lens: IDS,
    settings: props.settings,
    sources: props.sources,
    reticle: props.reticle ?? { x: 10, y: 20 },
    size: SIZE,
    describe: (c: string) => `vs ${c}`,
  };
  return (
    <>
      <div data-testid="slot">
        <LensSlot {...shared} />
      </div>
      <div data-testid="chrome">
        <LensChrome {...shared} />
      </div>
    </>
  );
}

const chrome = () => screen.getByTestId('chrome');
const slot = () => screen.getByTestId('slot');

describe('LensSlot and LensChrome', () => {
  it('names the source it shows', () => {
    const live = fakeSource('live');
    render(<Both settings={settings()} sources={{ live: live.source }} />);
    expect(chrome().textContent).toContain('Live');
    expect(live.attach).toHaveBeenCalledTimes(1);
  });

  it('falls back to Live and says why when Pixels is unavailable', () => {
    const live = fakeSource('live');
    const pixels = fakeSource('pixels', { status: 'install playwright' });
    render(
      <Both
        settings={settings({ source: 'pixels' })}
        sources={{ live: live.source, pixels: pixels.source }}
      />,
    );
    expect(chrome().textContent).toContain('Live');
    expect(slot().textContent).toContain('Pixels unavailable: install playwright');
    expect(live.attach).toHaveBeenCalledTimes(1);
    expect(pixels.attach).not.toHaveBeenCalled();
  });

  it('switches to Pixels when it becomes available', () => {
    const live = fakeSource('live');
    const pixels = fakeSource('pixels', { status: 'install playwright' });
    render(
      <Both
        settings={settings({ source: 'pixels' })}
        sources={{ live: live.source, pixels: pixels.source }}
      />,
    );
    act(() => pixels.setStatus(true));
    expect(pixels.attach).toHaveBeenCalledTimes(1);
    expect(live.detach).toHaveBeenCalledTimes(1);
    expect(slot().textContent).not.toContain('unavailable');
  });

  it('shows the reason and attaches nothing when no source is available', () => {
    render(<Both settings={settings({ source: 'pixels' })} sources={{}} />);
    expect(slot().textContent).toContain('Pixels unavailable: not provided');
  });

  it('attaches one pixels source per DPR side by side', () => {
    const pixels = fakeSource('pixels', { label: (r) => `Pixels ${r.dpr}×` });
    render(
      <Both settings={settings({ source: 'pixels', dprs: [1, 2] })} sources={{ pixels: pixels.source }} />,
    );
    expect(pixels.attach).toHaveBeenCalledTimes(2);
    expect(pixels.attach.mock.calls.map(([, r]) => r.dpr)).toEqual([1, 2]);
    expect(pixels.attach.mock.calls.map(([, r]) => r.size.width)).toEqual([80, 80]);
    const cells = pixels.attach.mock.calls.map(([el]) => el);
    expect(cells[0]).not.toBe(cells[1]);
    expect(chrome().textContent).toContain('Pixels 1×');
    expect(chrome().textContent).toContain('Pixels 2×');
  });

  it('re-sends the request, not a re-attach, when the reticle moves', () => {
    const live = fakeSource('live');
    const { rerender } = render(<Both settings={settings()} sources={{ live: live.source }} />);
    expect(live.update).not.toHaveBeenCalled();
    rerender(
      <Both settings={settings()} sources={{ live: live.source }} reticle={{ x: 40, y: 50 }} />,
    );
    expect(live.update).toHaveBeenCalled();
    expect(live.update.mock.lastCall?.[0].reticle).toEqual({ x: 40, y: 50 });
    expect(live.attach).toHaveBeenCalledTimes(1);
    expect(live.detach).not.toHaveBeenCalled();
  });

  it('detaches on unmount', () => {
    const live = fakeSource('live');
    const { unmount } = render(<Both settings={settings()} sources={{ live: live.source }} />);
    unmount();
    expect(live.detach).toHaveBeenCalledTimes(1);
  });

  it('names the comparison beside the source', () => {
    const live = fakeSource('live');
    render(<Both settings={settings({ compare: 'dark' })} sources={{ live: live.source }} />);
    expect(chrome().textContent).toContain('vs dark');
  });

  it('triggers the source actions through the registry', () => {
    const live = fakeSource('live');
    const ran = vi.fn();
    function Spy() {
      const registry = useActionsRegistry();
      useEffect(
        () =>
          registry?.register({
            id: 'loupe.source.pixels',
            label: 'Source: pixels',
            invoker: { timing: 'immediate', run: ran },
          } satisfies Action),
        [registry],
      );
      return null;
    }
    render(
      <ActionsProvider>
        <Spy />
        <Both settings={settings()} sources={{ live: live.source }} />
      </ActionsProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pixels' }));
    expect(ran).toHaveBeenCalledTimes(1);
  });

  it('presses the toggle of the source that renders, not the one wanted', () => {
    const live = fakeSource('live');
    const pixels = fakeSource('pixels', { status: 'install playwright' });
    render(
      <Both
        settings={settings({ source: 'pixels' })}
        sources={{ live: live.source, pixels: pixels.source }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Live' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Pixels' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('sends no update for the remount StrictMode forces', () => {
    const live = fakeSource('live');
    render(
      <StrictMode>
        <Both settings={settings()} sources={{ live: live.source }} />
      </StrictMode>,
    );
    expect(live.update).not.toHaveBeenCalled();
  });

  it('focuses its own lens before a toggle fires, so the action lands there', () => {
    const live = fakeSource('live');
    let current = 'a';
    const landed: string[] = [];
    function Spy() {
      const registry = useActionsRegistry();
      useEffect(
        () =>
          registry?.register({
            id: 'loupe.source.pixels',
            label: 'Source: pixels',
            invoker: { timing: 'immediate', run: () => landed.push(current) },
          } satisfies Action),
        [registry],
      );
      return null;
    }
    const ids = (lensId: string) => ({ ...IDS, lensId });
    const chromeOf = (lensId: string) => (
      <div data-testid={`chrome-${lensId}`}>
        <LensChrome
          lens={ids(lensId)}
          settings={settings()}
          sources={{ live: live.source }}
          reticle={{ x: 0, y: 0 }}
          size={SIZE}
          describe={String}
          onFocus={(id) => {
            current = id;
          }}
        />
      </div>
    );
    render(
      <ActionsProvider>
        <Spy />
        {chromeOf('a')}
        {chromeOf('b')}
      </ActionsProvider>,
    );
    fireEvent.click(within(screen.getByTestId('chrome-b')).getByRole('button', { name: 'Pixels' }));
    expect(landed).toEqual(['b']);
  });
});

describe('LensSlot comparisons', () => {
  const conditionsOf = (attach: ReturnType<typeof fakeSource>['attach']) =>
    attach.mock.calls.map(([, r]) => r.conditions);

  it('attaches only the compared request in Swap', () => {
    const live = fakeSource('live');
    render(<Both settings={settings({ compare: 'b', view: 'swap' })} sources={{ live: live.source }} />);
    expect(conditionsOf(live.attach)).toEqual(['b']);
  });

  it('attaches the story as it is on the left and the compared one on the right in Split', () => {
    const live = fakeSource('live');
    render(
      <Both
        settings={settings({ compare: 'b', view: 'split', seam: 0.25 })}
        sources={{ live: live.source }}
      />,
    );
    expect(conditionsOf(live.attach)).toEqual([null, 'b']);
    const slot = screen.getByTestId('slot').querySelector<HTMLElement>('.lk-lens-slot')!;
    expect(slot.dataset.view).toBe('split');
    expect(slot.style.getPropertyValue('--lk-lens-seam')).toBe(`${SIZE.width * 0.25}px`);
    const sides = [...slot.querySelectorAll<HTMLElement>('.lk-lens-side')].map((s) => s.dataset.side);
    expect(sides).toEqual(['base', 'compared']);
  });

  it('says why Difference cannot show, with no Pixels source', () => {
    const live = fakeSource('live');
    render(
      <Both settings={settings({ compare: 'b', view: 'difference' })} sources={{ live: live.source }} />,
    );
    expect(within(screen.getByTestId('slot')).getByText('Pixels unavailable: not provided')).toBeTruthy();
    expect(live.attach).not.toHaveBeenCalled();
  });

  it('says why Difference cannot show while Pixels is unavailable', () => {
    const pixels = fakeSource('pixels', { status: 'install playwright' });
    render(
      <Both
        settings={settings({ compare: 'b', view: 'difference' })}
        sources={{ pixels: pixels.source }}
      />,
    );
    expect(
      within(screen.getByTestId('slot')).getByText('Pixels unavailable: install playwright'),
    ).toBeTruthy();
  });

  it('captures both sides from Pixels for Difference, even on a Live lens', async () => {
    const live = fakeSource('live');
    const pixels = fakeSource('pixels');
    const capture = vi.fn(async (_r: LensSourceRequest<string>) => null);
    pixels.source.capture = capture;
    render(
      <Both
        settings={settings({ source: 'live', compare: 'b', view: 'difference' })}
        sources={{ live: live.source, pixels: pixels.source }}
      />,
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(capture.mock.calls.map(([r]) => r.conditions)).toEqual([null, 'b']);
    expect(live.attach).not.toHaveBeenCalled();
    expect(within(screen.getByTestId('slot')).getByText('Nothing to compare')).toBeTruthy();
  });
});
