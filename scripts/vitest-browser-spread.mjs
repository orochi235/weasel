import { playwright, PlaywrightBrowserProvider } from '@vitest/browser-playwright';

/**
 * How many Chromiums the browser project runs in on a node with `cores` cores, and how many tabs each.
 * Files drawing WebGL slow each other within one Chromium, so on 10 cores or more each tab gets its
 * own. Alone on teitou (18 cores) on 2026-11-07, 18 Chromiums of one tab ran the project in a mean of
 * 76.2 s, nine of two in 78.7 s, six of three in 82.5 s, and the three processes of six tabs it
 * replaced in 94.8 s, spending nearly twice as long in tests (`scripts/bench-browser-project.runs.jsonl`).
 * Nothing below 10 cores was measured, so it keeps one Chromium of six tabs there.
 * WEASEL_BROWSER_CHROMIUMS and WEASEL_BROWSER_TABS override either.
 */
export const browserShape = (cores, env = process.env) => {
  const wide = cores >= 10;
  return {
    chromiums: Number(env.WEASEL_BROWSER_CHROMIUMS) || (wide ? 18 : 1),
    tabs: Number(env.WEASEL_BROWSER_TABS) || (wide ? 1 : 6),
  };
};

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
