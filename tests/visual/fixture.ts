/**
 * The visual suite's `test`: Playwright's, with every `page.goto` carrying
 * `?backend=` when `WEASEL_VISUAL_BACKEND` is set, so the site paints every
 * canvas with that backend against the same baselines.
 */
import { test as base } from '@playwright/test';

export { expect, type Locator, type Page } from '@playwright/test';

const backend = process.env.WEASEL_VISUAL_BACKEND;

/** `url` with `backend=<backend>` in its query, ahead of any hash. */
export function withBackend(url: string, backend: string): string {
  const hashAt = url.indexOf('#');
  const head = hashAt < 0 ? url : url.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : url.slice(hashAt);
  const queryAt = head.indexOf('?');
  const path = queryAt < 0 ? head : head.slice(0, queryAt);
  const query = new URLSearchParams(queryAt < 0 ? '' : head.slice(queryAt + 1));
  query.set('backend', backend);
  return `${path}?${query}${hash}`;
}

export const test = base.extend({
  page: async ({ page }, use) => {
    if (backend) {
      const goto = page.goto.bind(page);
      page.goto = (url, options) => goto(withBackend(url, backend), options);
    }
    await use(page);
  },
});
