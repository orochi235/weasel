import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import type { ViewTransform } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { SurfaceContext } from '../surface/SurfaceContext';
import type { SurfaceHandle } from '../surface/useTiledSurface';
import { fitStage, Stage } from './Stage';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

function content(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('.lk-stage__content');
  if (!el) throw new Error('no stage content');
  return el;
}

const zoomOf = (el: HTMLElement): number => Number(el.style.getPropertyValue('--lk-stage-zoom'));

describe('fitStage', () => {
  it('shrinks content that does not fit, and centers it on the short axis', () => {
    expect(fitStage({ width: 400, height: 200 }, { width: 200, height: 200 })).toEqual({
      zoom: 0.5,
      pan: { x: 0, y: 50 },
    });
  });

  it('never enlarges content past its own size', () => {
    expect(fitStage({ width: 100, height: 50 }, { width: 300, height: 150 })).toEqual({
      zoom: 1,
      pan: { x: 100, y: 50 },
    });
  });

  it('answers the identity for an unmeasured viewport', () => {
    expect(fitStage({ width: 100, height: 50 }, { width: 0, height: 0 })).toEqual({
      zoom: 1,
      pan: { x: 0, y: 0 },
    });
  });
});

describe('<Stage>', () => {
  it('draws its content through the camera', () => {
    const { container } = render(
      <Stage
        size={{ width: 300, height: 100 }}
        view={{ zoom: 2, pan: { x: 10, y: 20 } }}
        onViewChange={() => {}}
      >
        <div data-testid="art" />
      </Stage>,
    );
    const el = content(container);
    expect(el).toContainElement(screen.getByTestId('art'));
    expect(zoomOf(el)).toBe(2);
    expect(el.style.getPropertyValue('--lk-stage-x')).toBe('10px');
    expect(el.style.getPropertyValue('--lk-stage-y')).toBe('20px');
    expect(el.style.getPropertyValue('--lk-stage-w')).toBe('300px');
    expect(el.style.getPropertyValue('--lk-stage-h')).toBe('100px');
  });

  it('zooms on the wheel', () => {
    function Host() {
      const [view, setView] = useState<ViewTransform>({ zoom: 1, pan: { x: 0, y: 0 } });
      return (
        <Stage size={{ width: 100, height: 100 }} view={view} onViewChange={setView}>
          <div />
        </Stage>
      );
    }
    const { container } = render(<Host />);
    const host = container.querySelector('.lk-stage');
    if (!host) throw new Error('no stage');
    fireEvent.wheel(host, { deltaY: -200, clientX: 0, clientY: 0 });
    expect(zoomOf(content(container))).toBeGreaterThan(1);
  });

  it('tells the surface its tiles moved when the camera does', () => {
    // A transform moves a tile without resizing anything, which is the one
    // kind of move a ResizeObserver never reports.
    const invalidateRects = vi.fn();
    const surface = { invalidateRects } as unknown as SurfaceHandle;
    const at = (view: ViewTransform) => (
      <SurfaceContext.Provider value={surface}>
        <Stage size={{ width: 100, height: 100 }} view={view} onViewChange={() => {}}>
          <div />
        </Stage>
      </SurfaceContext.Provider>
    );
    const { rerender } = render(at({ zoom: 1, pan: { x: 0, y: 0 } }));
    invalidateRects.mockClear();
    rerender(at({ zoom: 1.5, pan: { x: 0, y: 0 } }));
    expect(invalidateRects).toHaveBeenCalled();
  });
});

const staged = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Staged',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div data-testid="art" />,
  stage: { size: { width: 240, height: 160 }, initialView: { zoom: 1, pan: { x: 0, y: 0 } } },
});

const plain = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Plain',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div data-testid="art" />,
});

describe('an instrument that declares a stage', () => {
  it('renders its DOM on the stage', () => {
    const { container } = render(<Lab instruments={[staged]} defaultInstrument="Staged" />);
    expect(content(container)).toContainElement(screen.getByTestId('art'));
  });

  it('gets the zoom controls, and they move the stage', () => {
    const { container } = render(<Lab instruments={[staged]} defaultInstrument="Staged" />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    });
    expect(zoomOf(content(container))).toBeCloseTo(1.25);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Actual size' }));
    });
    expect(zoomOf(content(container))).toBe(1);
  });

  it('is what earns them: DOM content without one gets none', () => {
    render(<Lab instruments={[plain]} defaultInstrument="Plain" />);
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull();
  });
});
