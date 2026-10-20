import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, render, waitFor } from '@testing-library/react';
import { WeaselProvider } from '@weasel-js/core';
import { afterEach, expect, test } from 'vitest';
import { commands } from 'vitest/browser';
import { CanvasStack } from '../canvas/CanvasStack';
import { TrialLoupe } from './TrialLoupe';

// The lens follows the real mouse, pressed or not, and goes away when it
// leaves. Every other test of the aim fires synthetic events at the host; this
// one moves the browser's own pointer, so the events are trusted, carry the
// button state Chrome gives them, and pass through any pointer capture.

afterEach(async () => {
  await commands.pointer([{ up: true }]);
  cleanup();
});

const CSS_W = 120;
const CSS_H = 60;
const VIEW = { zoom: 1, pan: { x: 0, y: 0 } };

/** DOM content, so the lens mounts a dispatcher of its own on `.lk-loupe-host`. */
function DomScene() {
  return (
    <WeaselProvider isolate>
      <div style={{ width: CSS_W, height: CSS_H, margin: 40 }}>
        <TrialLoupe enabled factor={4} diameter={20} render={() => <div />}>
          <div style={{ width: CSS_W, height: CSS_H }} />
        </TrialLoupe>
      </div>
    </WeaselProvider>
  );
}

/** A canvas stack, whose camera's dispatcher takes the press and captures it. */
function CameraScene() {
  return (
    <WeaselProvider isolate>
      <div style={{ width: CSS_W, height: CSS_H, margin: 40 }}>
        <CanvasStack layers={[]} view={VIEW} onViewChange={() => {}}>
          <TrialLoupe enabled factor={4} diameter={20} />
        </CanvasStack>
      </div>
    </WeaselProvider>
  );
}

/** The lens's center in the host's CSS px, rounded to the nearest half pixel,
 *  or null with no lens up. */
function lensCenter(host: HTMLElement): { x: number; y: number } | null {
  const lens = document.querySelector<HTMLElement>('.lk-loupe');
  if (!lens) return null;
  const l = lens.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  const half = (n: number): number => Math.round(n * 2) / 2;
  return { x: half(l.left + l.width / 2 - h.left), y: half(l.top + l.height / 2 - h.top) };
}

/** A client point `x`, `y` px into the host. */
function at(host: HTMLElement, x: number, y: number): { to: [number, number] } {
  const r = host.getBoundingClientRect();
  return { to: [r.left + x, r.top + y] };
}

const scenes = [
  { name: 'over DOM content', Scene: DomScene, host: '.lk-loupe-host' },
  { name: 'over a canvas stack', Scene: CameraScene, host: '.lk-canvas-stack' },
] as const;

for (const { name, Scene, host: selector } of scenes) {
  test(`the lens follows a real pointer ${name}, pressed and released`, async () => {
    render(<Scene />);
    const host = document.querySelector<HTMLElement>(selector)!;
    await commands.pointer([at(host, 5, 5), at(host, 20, 20)]);
    await waitFor(() => expect(lensCenter(host)).toEqual({ x: 20, y: 20 }));

    await commands.pointer([{ down: true }, at(host, 40, 25), at(host, 60, 30)]);
    await waitFor(() => expect(lensCenter(host)).toEqual({ x: 60, y: 30 }));

    await commands.pointer([{ up: true }, at(host, 70, 35)]);
    await waitFor(() => expect(lensCenter(host)).toEqual({ x: 70, y: 35 }));
  });

  test(`the lens goes away when a real pointer leaves ${name}, pressed or not`, async () => {
    render(<Scene />);
    const host = document.querySelector<HTMLElement>(selector)!;
    await commands.pointer([at(host, 20, 20)]);
    await waitFor(() => expect(lensCenter(host)).not.toBeNull());
    await commands.pointer([at(host, CSS_W + 30, 20)]);
    await waitFor(() => expect(lensCenter(host)).toBeNull());

    await commands.pointer([at(host, 20, 20), { down: true }, at(host, 30, 20)]);
    await waitFor(() => expect(lensCenter(host)).toEqual({ x: 30, y: 20 }));
    await commands.pointer([at(host, CSS_W + 30, 20), { up: true }, at(host, CSS_W + 31, 20)]);
    await waitFor(() => expect(lensCenter(host)).toBeNull());
  });
}
