import type { Browser, Page } from '@playwright/test';

/**
 * The browser half of a result's machine fingerprint, for specs that do not
 * open a GL context of their own. Reads the unmasked renderer from a throwaway
 * canvas, so a software backend shows up in the result.
 */
export async function browserFingerprint(page: Page, browser: Browser, browserName: string) {
  const glRenderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  });
  return { glRenderer, browser: `${browserName} ${browser.version()}` };
}
