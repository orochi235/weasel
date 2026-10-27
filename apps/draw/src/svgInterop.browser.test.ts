/**
 * Save SVG waits for `warmSvg` before it serializes, so `downloadSvg` runs
 * after the click has returned — past Chromium's roughly five-second transient
 * user activation, if a paint kind is slow to load. The download must still
 * go through.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { asPaint, IDENTITY_POSE_COMPOSITION, registerPaintKindLoader, layoutPages } from '@weasel-js/core';
import { downloadSvg } from './svgInterop';
import { sceneToSvgString } from './svgExport';

const PAGE = { filename: 'page', pages: layoutPages([{ id: 'page-1', width: 100, height: 100 }]), backgroundColor: '#ffffff' } as const;

/** A scene with one rect filled by paint kind `id`, whose loader takes `ms`. */
function slowPaintScene(id: string, ms: number) {
  disposers.push(registerPaintKindLoader(id, async () => {
    await new Promise((r) => setTimeout(r, ms));
    return {
      id, label: id, seed: () => asPaint({ kind: id }), colorOf: () => '#123456',
      toSvg: (defId: string) => `<linearGradient id="${defId}" data-kind="${id}"/>`,
    };
  }));
  const rect = {
    id: 'a', kind: 'mark', layer: 'default', parent: null,
    pose: { x: 0, y: 0, width: 10, height: 10 },
    data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: asPaint({ kind: id }) } },
  };
  return {
    roots: ['a'], get: (n: string) => (n === 'a' ? rect : undefined), childrenOf: () => [],
    composition: IDENTITY_POSE_COMPOSITION,
  } as never;
}

/** How long past the load a download may take to arrive. */
const SLACK_MS = 30_000;

const disposers: (() => void)[] = [];
let button: HTMLButtonElement | null = null;
afterEach(() => {
  for (const d of disposers.splice(0)) d();
  button?.remove();
  button = null;
});

function saveButton(onClick: () => void) {
  button = document.createElement('button');
  button.textContent = 'save';
  button.addEventListener('click', onClick);
  document.body.appendChild(button);
  return page.getByRole('button', { name: 'save' });
}

describe('Save SVG after a paint kind loads', () => {
  it.each([0, 6500])('downloads when the load takes %dms', async (ms) => {
    const kind = `test-slow-${ms}`;
    const scene = slowPaintScene(kind, ms);
    let activeAtDownload: boolean | null = null;
    const save = saveButton(() => {
      void sceneToSvgString(scene, PAGE).then((svg) => {
        activeAtDownload = navigator.userActivation.isActive;
        downloadSvg(svg, 'page.svg');
      });
    });
    // Far longer than the load: a download that lands late in a busy run is still this test's, not the next one's.
    await commands.armDownload(ms + SLACK_MS);
    await userEvent.click(save);
    const download = await commands.takeDownload();
    expect(download?.filename).toBe('page.svg');
    expect(download?.text).toContain(`data-kind="${kind}"`);
    // The longest wait outlives the click's activation, so it is what proves the point.
    expect(activeAtDownload).toBe(ms < 5000);
  }, 6500 + SLACK_MS + 5000);

  it('reports no download for a click that starts none', async () => {
    const save = saveButton(() => {});
    await commands.armDownload(1000);
    await userEvent.click(save);
    expect(await commands.takeDownload()).toBeNull();
  });
});
