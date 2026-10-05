/**
 * Serve the perf page cross-origin isolated, which is what unlocks a
 * microsecond `performance.now()` in Chromium instead of the 100 us it is
 * otherwise coarsened to. Done per spec by rewriting the document's headers rather than
 * in `vite.config.ts`, so no dev server anyone else runs changes.
 *
 * `credentialless` rather than `require-corp`, so a cross-origin subresource
 * the site happens to load still loads instead of logging an error the specs
 * would fail on.
 */
import type { Page } from '@playwright/test';

export async function isolate(page: Page): Promise<void> {
  await page.route((url) => url.pathname === '/weasel/', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-embedder-policy': 'credentialless',
      },
    });
  });
}
