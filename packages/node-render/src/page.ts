// Runs inside the host's Chromium page, bundled with everything it imports into one classic script:
// the page is `about:blank`, which cannot load modules.
import {
  createRasterSession, rasterToPng, sceneFromJSON, warmRender, type RasterRenderArgs, type SavedScene,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { PAGE_GLOBAL, sceneFromWire, type PageApi, type PageRequest, type PageResult } from './protocol';

const session = createRasterSession();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function render(req: PageRequest): Promise<PageResult> {
  const { scene, screen, format, overlay, ...rest } = req;
  const args: RasterRenderArgs<unknown, string, unknown> = {
    ...rest,
    scene: sceneFromJSON(sceneFromWire(scene) as SavedScene<unknown, string, unknown>),
    ...(overlay ? { overlay: overlay as readonly DrawCommand[] } : {}),
    ...(screen ? { screen: Float64Array.from(screen) } : {}),
  };
  await warmRender({ render: args });
  const image = session.render(args);
  if (format === 'png') {
    const blob = await rasterToPng(image);
    return { width: image.width, height: image.height, base64: toBase64(new Uint8Array(await blob.arrayBuffer())) };
  }
  const bytes = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength);
  return { width: image.width, height: image.height, base64: toBase64(bytes) };
}

const api: PageApi = { render };
(globalThis as Record<string, unknown>)[PAGE_GLOBAL] = api;
