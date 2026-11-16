import { createRasterSession, rasterToPng, warmRender } from '@weasel-js/core';
import { PAGE_GLOBAL, type PageApi, type PageRequest, type PageResult } from './protocol';
import { pageRenderArgs, type PageSceneOptions } from './pageLoad';

export type { PageSceneOptions } from './pageLoad';

/** How a headless page reads and draws the scenes the host sends. Everything here is code, so it
 *  is the page script's to give: a request crosses as JSON. */
export interface HeadlessPageOptions {
  /** What each request's scene is read back with: the host's scenes' `registry`, which their node
   *  functions resolve against, and their `composition`, `layoutFrame` and `quantize`. A snapshot
   *  carries none of these, so match the scenes the host renders. Default: none, which reads only
   *  a scene of the kit's own functions under the rigid composition. */
  scene?: PageSceneOptions;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Serve the host's renders from this page: the call a page script makes once, after registering its
 * fonts, paint kinds and node shapes. The default page script calls it with no options.
 */
export function serveHeadlessPage(options: HeadlessPageOptions = {}): void {
  const root = globalThis as Record<string, unknown>;
  if (Object.hasOwn(root, PAGE_GLOBAL)) throw new Error('serveHeadlessPage: this page already serves renders');
  const session = createRasterSession();
  const sceneOptions = options.scene ?? {};

  async function render(sent: PageRequest): Promise<PageResult> {
    const { args, format } = pageRenderArgs(sent, sceneOptions);
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
  root[PAGE_GLOBAL] = api;
}
