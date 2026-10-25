import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import './LentTopBuffer.browser.test.less';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { sceneToAdapter } from '@weasel-js/core';
import { readCanvas } from '@weasel-js/core/testing/canvasPixels';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { type ReactNode, useState } from 'react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { commands, page } from 'vitest/browser';
import { defineInstrument } from '../instrument/defineInstrument';
import { LensOverlay } from '../loupe/lens/LensOverlay';
import { addLensOps, createLensScene } from '../loupe/lens/lensScene';
import { BODY_SIZE, type LensScene } from '../loupe/lens/lensTypes';
import { SurfaceCanvasContext, SurfaceContext } from '../surface/SurfaceContext';
import { useTiledSurface } from '../surface/useTiledSurface';
import { Lab } from './Lab';

// A lab under a host whose surface publishes only `over` and `under` makes its
// own `top` buffer on the host's container. Whether the lens paints there, and
// whether a press beside it still reaches the trial, need a real browser.

let clicks = 0;
let scene: LensScene<string>;
const BODY_AT = { x: 560, y: 260 };

/** A surface owner with no whole-surface tenant of its own, so it offers no `top`. */
function Host({ children }: { children: ReactNode }) {
  const surface = useTiledSurface({ onFrame: () => {} });
  const [canvases] = useState(() => ({
    over: document.createElement('canvas'),
    under: document.createElement('canvas'),
  }));
  return (
    <SurfaceContext.Provider value={surface}>
      <SurfaceCanvasContext.Provider value={canvases}>
        <div className="lk-lent-test-host" ref={surface.containerRef}>
          {children}
        </div>
      </SurfaceCanvasContext.Provider>
    </SurfaceContext.Provider>
  );
}

const Story = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Story',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => (
    <div className="lk-lent-test-floor">
      <button type="button" className="lk-lent-test-under" onClick={() => clicks++}>
        Under
      </button>
    </div>
  ),
});

afterEach(async () => {
  await commands.pointer([{ up: true }]);
  cleanup();
});
beforeEach(async () => {
  await page.viewport(1000, 700);
  clicks = 0;
  scene = createLensScene<string>();
  sceneToAdapter(scene).applyOps(
    addLensOps(scene, 'a', { body: BODY_AT, reticle: { x: 300, y: 260 } }),
    'add',
  );
});

async function mount(): Promise<HTMLElement> {
  renderWithIcons(
    <Host>
      <Lab
        instruments={[Story]}
        defaultInstrument="Story"
        labChrome={[
          { id: 'loupe', region: 'overlay', render: () => <LensOverlay scene={scene} /> },
        ]}
      />
    </Host>,
  );
  await screen.findByRole('button', { name: 'Under' });
  return document.querySelector('.lk-lent-test-host') as HTMLElement;
}

async function lentBuffer(host: HTMLElement): Promise<HTMLCanvasElement> {
  return waitFor(() => {
    const c = host.querySelector(':scope > canvas.lk-lab__surface--top');
    if (!(c instanceof HTMLCanvasElement)) throw new Error('no top buffer on the host');
    return c;
  });
}

function paintedNear(canvas: HTMLCanvasElement, x: number, y: number): boolean {
  const box = canvas.getBoundingClientRect();
  const dpr = canvas.width / box.width;
  const px = readCanvas(
    canvas,
    Math.round((x - 4 - box.left) * dpr),
    Math.round((y - box.top) * dpr),
    Math.round(8 * dpr),
    1,
  );
  for (let i = 3; i < px.length; i += 4) if ((px[i] ?? 0) > 0) return true;
  return false;
}

test("paints the lab's lenses into a top buffer of its own on the host's container", async () => {
  const host = await mount();
  const canvas = await lentBuffer(host);
  const box = host.getBoundingClientRect();
  await waitFor(() =>
    expect([canvas.width, canvas.height]).toEqual([
      Math.round(box.width * devicePixelRatio),
      Math.round(box.height * devicePixelRatio),
    ]),
  );
  expect(canvas.getBoundingClientRect().width).toBeCloseTo(box.width, 0);
  const rim: [number, number] = [box.left + BODY_AT.x + BODY_SIZE / 2, box.top + BODY_AT.y];
  await waitFor(() => expect(paintedNear(canvas, ...rim)).toBe(true), { timeout: 5000 });
});

test('lets a press that misses every lens reach the trial through the lent buffer', async () => {
  const host = await mount();
  await lentBuffer(host);
  const under = screen.getByRole('button', { name: 'Under' }).getBoundingClientRect();
  const at: [number, number] = [under.left + under.width / 2, under.top + under.height / 2];
  await commands.pointer([{ to: at }, { down: true }, { up: true }]);
  expect(clicks).toBe(1);
});
