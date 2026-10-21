import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import '../lab/presentation.browser.test.less';
import { cleanup, waitFor } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { useEffect, useRef } from 'react';
import { WebGLRenderer } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import type { Instrument, OrbitCapability } from '../instrument/types';
import { Lab } from '../lab/Lab';
import type { LabMode } from '../state/types';

// The jsdom suite fires three's devtools announcement by hand; this one builds
// real renderers, so it fails if three stops announcing or moves `domElement`.

type Kind = 'webgl' | 'webgpu';

/** A three.js view the way a consumer writes one: the renderer makes its own
 *  canvas, and the instrument appends it after the constructor returns. */
function ThreeScene({ kind }: { kind: Kind }) {
  const host = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const renderer = kind === 'webgl' ? new WebGLRenderer() : new WebGPURenderer();
    renderer.setSize(120, 80);
    host.current?.append(renderer.domElement);
    return () => {
      renderer.domElement.remove();
      renderer.dispose();
    };
  }, [kind]);
  return <div ref={host} />;
}

type Orbit = OrbitCapability<Record<string, never>, Record<string, never>> | false;

let made = 0;
/** A fresh instrument per test: the console warning fires once per instrument. */
function threeLab(kind: Kind, orbit?: Orbit): Instrument {
  return {
    name: `Three${++made}`,
    defaultConfig: () => ({}),
    initialState: () => ({}),
    render: () => <ThreeScene kind={kind} />,
    ...(orbit !== undefined ? { orbit } : {}),
  } as Instrument;
}

const mount = (instrument: Instrument, mode: LabMode = 'dark') =>
  renderWithIcons(
    <div className="lk-present-frame">
      <Lab instruments={[instrument]} defaultInstrument={instrument.name} mode={mode} />
    </div>,
  );

type Rgba = [number, number, number, number];

/** Any CSS color as 0-255 channels, read back from a 2D canvas, since a
 *  `color-mix()` computes to a `color(srgb …)` string. */
function rgba(css: string): Rgba {
  const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return [r ?? 0, g ?? 0, b ?? 0, (a ?? 0) / 255];
}

const over = (top: Rgba, under: Rgba): Rgba =>
  [...([0, 1, 2] as const).map((i) => top[i] * top[3] + under[i] * (1 - top[3])), 1] as Rgba;

const luminance = ([r, g, b]: Rgba) => {
  const lin = (v: number) =>
    v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const contrast = (a: Rgba, b: Rgba) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

let warn: MockInstance<typeof console.warn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  warn.mockRestore();
});

const cameraWarnings = () =>
  warn.mock.calls.filter((call) => String(call[0]).includes('draws a 3D view'));
const badge = () => document.querySelector<HTMLElement>('.lk-trial__no-camera');

describe('a real three.js renderer in a trial with no `orbit`', () => {
  it.each<Kind>(['webgl', 'webgpu'])('%s: warns, and marks the title bar', async (kind) => {
    const instrument = threeLab(kind);
    mount(instrument);
    await waitFor(() => expect(cameraWarnings()).toHaveLength(1));
    expect(String(cameraWarnings()[0]?.[0])).toContain(
      `"${instrument.name}" draws a 3D view (a three.js renderer)`,
    );
    await waitFor(() => expect(badge()).not.toBeNull());
  });

  it.each<'light' | 'dark'>(['light', 'dark'])(
    '%s: shows the badge whole, inside the title bar, at a readable contrast',
    async (mode) => {
      mount(threeLab('webgl'), mode);
      await waitFor(() => expect(badge()).not.toBeNull());
      const mark = badge() as HTMLElement;
      const bar = mark.closest('.lk-trial__titlebar') as HTMLElement;
      const box = mark.getBoundingClientRect();
      const barBox = bar.getBoundingClientRect();
      expect(mark.textContent).toBe('no camera');
      expect(mark.scrollWidth).toBeLessThanOrEqual(mark.clientWidth);
      expect(box.left).toBeGreaterThanOrEqual(barBox.left);
      expect(box.right).toBeLessThanOrEqual(barBox.right);
      expect(box.top).toBeGreaterThanOrEqual(barBox.top);
      expect(box.bottom).toBeLessThanOrEqual(barBox.bottom);
      const ground = over(
        rgba(getComputedStyle(mark).backgroundColor),
        rgba(getComputedStyle(bar).backgroundColor),
      );
      expect(contrast(rgba(getComputedStyle(mark).color), ground)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe('a real three.js renderer under a declared `orbit`', () => {
  it.each<[string, Orbit]>([
    ['orbit: false', false],
    ['orbit: { fixed: true }', { fixed: true }],
  ])('%s: says nothing', async (_, orbit) => {
    mount(threeLab('webgl', orbit));
    // The watcher retries for a second while a canvas joins the DOM.
    await new Promise((r) => setTimeout(r, 1300));
    expect(cameraWarnings()).toEqual([]);
    expect(badge()).toBeNull();
  });
});
