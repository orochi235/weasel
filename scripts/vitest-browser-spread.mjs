import { playwright, PlaywrightBrowserProvider } from '@vitest/browser-playwright';

/**
 * vitest's playwright provider, its pages dealt round-robin across `count` Chromium processes rather
 * than all opened in one. The one vitest process feeds every page from its one queue, so no Chromium
 * idles while another still holds files. `count` 1 is the stock provider.
 */
export const spreadPlaywright = (options, count) => {
  const base = playwright(options);
  if (count <= 1) return base;
  return { ...base, providerFactory: (project) => new SpreadProvider(project, options, count) };
};

class SpreadProvider extends PlaywrightBrowserProvider {
  constructor(project, options, count) {
    super(project, options);
    this.spreadCount = count;
    this.spreadNext = 0;
    this.spreadExtra = [];
  }

  // The stock provider calls this once per page context, and only there.
  async openBrowser(openOptions) {
    const primary = await super.openBrowser(openOptions);
    const i = this.spreadNext++ % this.spreadCount;
    if (i === 0) return primary;
    this.spreadExtra[i - 1] ??= import('playwright').then((pw) =>
      pw[this.browserName].launch({ ...this.options.launchOptions, headless: this.project.config.browser.headless }),
    );
    return this.spreadExtra[i - 1];
  }

  async close(options) {
    const extra = this.spreadExtra;
    this.spreadExtra = [];
    await super.close(options);
    await Promise.all(extra.map((b) => b.then((browser) => browser.close()).catch(() => {})));
  }
}
