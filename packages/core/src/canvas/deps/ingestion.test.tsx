import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  DepRegistryProvider,
  useDepRegistry,
  type DepRegistry,
} from 'interactions/actions/depRegistry';
import { useIngestionDepSource } from './ingestion';
import type { View } from 'core/viewport/view';

function Capture({ onR }: { onR: (r: DepRegistry) => void }) {
  const r = useDepRegistry();
  onR(r);
  return null;
}

describe('useIngestionDepSource', () => {
  it('viewportWorldRect maps the canvas rect through the view (scale 2 → half size)', () => {
    const fakeCanvas = {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
      }),
    } as unknown as HTMLCanvasElement;
    const canvasRef = { current: fakeCanvas } as React.RefObject<HTMLCanvasElement | null>;
    const getView = (): View => ({ x: 0, y: 0, scale: { x: 2, y: 2 } });

    let reg!: DepRegistry;
    function Wire() {
      useIngestionDepSource(canvasRef, getView);
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );

    const dep = reg.get('ingestion');
    expect(dep).toBeDefined();
    const rect = dep!.viewportWorldRect();
    expect(rect.x).toBeCloseTo(0);
    expect(rect.y).toBeCloseTo(0);
    expect(rect.width).toBeCloseTo(400);
    expect(rect.height).toBeCloseTo(300);
  });

  it('maps an off-origin canvas rect through an offset view (full transform)', () => {
    // Non-zero rect origin + non-zero view offset so a corner-wiring bug
    // (e.g. width/height passed where right/bottom client coords belong)
    // cannot cancel out. world = (client - rect.left) / scale + view.x.
    const fakeCanvas = {
      getBoundingClientRect: () => ({
        left: 100,
        top: 40,
        width: 800,
        height: 600,
        right: 900,
        bottom: 640,
      }),
    } as unknown as HTMLCanvasElement;
    const canvasRef = { current: fakeCanvas } as React.RefObject<HTMLCanvasElement | null>;
    const getView = (): View => ({ x: 50, y: -20, scale: { x: 2, y: 2 } });

    let reg!: DepRegistry;
    function Wire() {
      useIngestionDepSource(canvasRef, getView);
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );

    const dep = reg.get('ingestion');
    expect(dep).toBeDefined();
    const rect = dep!.viewportWorldRect();
    expect(rect.x).toBeCloseTo(50);   // (100 - 100) / 2 + 50
    expect(rect.y).toBeCloseTo(-20);  // (40 - 40) / 2 + (-20)
    expect(rect.width).toBeCloseTo(400);
    expect(rect.height).toBeCloseTo(300);
  });

  it('returns a zero rect when the canvas is unmounted', () => {
    const nullRef = { current: null } as React.RefObject<HTMLCanvasElement | null>;
    const getView = (): View => ({ x: 0, y: 0, scale: { x: 1, y: 1 } });

    let reg!: DepRegistry;
    function Wire() {
      useIngestionDepSource(nullRef, getView);
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );

    const dep = reg.get('ingestion');
    expect(dep).toBeDefined();
    const rect = dep!.viewportWorldRect();
    expect(rect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('forwards resolveSrc', () => {
    const fakeCanvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as unknown as HTMLCanvasElement;
    const canvasRef = { current: fakeCanvas } as React.RefObject<HTMLCanvasElement | null>;
    const getView = (): View => ({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const resolve = async (_f: File) => 'x';

    let reg!: DepRegistry;
    function Wire() {
      useIngestionDepSource(canvasRef, getView, resolve);
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );

    const dep = reg.get('ingestion');
    expect(dep).toBeDefined();
    expect(dep!.resolveSrc).toBe(resolve);
  });

  it('resolveSrc is absent when not provided', () => {
    const fakeCanvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as unknown as HTMLCanvasElement;
    const canvasRef = { current: fakeCanvas } as React.RefObject<HTMLCanvasElement | null>;
    const getView = (): View => ({ x: 0, y: 0, scale: { x: 1, y: 1 } });

    let reg!: DepRegistry;
    function Wire() {
      useIngestionDepSource(canvasRef, getView);
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );

    const dep = reg.get('ingestion');
    expect(dep).toBeDefined();
    expect(dep!.resolveSrc).toBeUndefined();
  });
});
