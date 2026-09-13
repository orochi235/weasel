// Headless check that forge renders a sample of Storybook's CSF stories: node apps/forge/e2e/csf.mjs [origin] [screenshot-dir]
import { chromium } from '@playwright/test';

const [origin = 'http://[::1]:5178', shots = '.'] = process.argv.slice(2);

/** Each check runs once the frame has rendered, and throws on what it finds wrong. */
const stories = [
  {
    id: 'weasel-ui-foundations-button--primary',
    what: 'ui story with argTypes',
    check: async ({ frame, page }) => {
      await frame.getByRole('button').first().waitFor();
      await page.getByText(/^variant$/i).first().waitFor();
    },
  },
  {
    id: 'draw-actionbar--emptydocument',
    what: 'apps/draw story, inside #root and on screen',
    check: async ({ frame }) => {
      const box = await frame.locator('body').evaluate(() => {
        const story = document.querySelector('#root > .fg-frame')?.firstElementChild;
        const rect = story?.getBoundingClientRect();
        return rect ? { top: rect.top, height: rect.height, viewport: innerHeight } : null;
      });
      if (!box) throw new Error('no story under #root > .fg-frame');
      if (!(box.height > 0 && box.top >= 0 && box.top < box.viewport)) {
        throw new Error(`story is off screen: top ${box.top}, height ${box.height}, viewport ${box.viewport}`);
      }
    },
  },
  {
    id: 'labkit-lab-fit--fullscreenwide',
    what: 'labkit/Lab/Fit export',
    // The story mounts its Lab in a host of its own under <body>, outside the frame's wrapper.
    rendered: '.lk-lab',
    check: async ({ frame }) => {
      await frame.locator('.lk-lab').first().waitFor();
    },
  },
  {
    id: 'weasel-ui-foundations-slider--playground',
    what: 'Slider updating its own args with useArgs',
    check: async ({ frame }) => {
      await frame.getByText('3 thumbs').waitFor();
      await frame.getByRole('button', { name: '+ Add' }).click();
      await frame.getByText('4 thumbs').waitFor();
    },
  },
  {
    id: 'labkit-primitives-jobprogress--determinate',
    what: 'labkit story inside the .lk-root decorator',
    check: async ({ frame }) => {
      const rooted = await frame
        .locator('.fg-frame')
        .evaluate((wrapper) => wrapper.firstElementChild?.matches('.lk-root') && wrapper.firstElementChild.children.length > 0);
      if (!rooted) throw new Error("the story's root has no .lk-root ancestor");
    },
  },
  {
    id: 'labkit-primitives-jobprogress--determinate',
    what: 'CSS Vars override of a themed token reaching inside the ThemeProvider wrapper',
    check: async ({ frame, page }) => {
      const OVERRIDE = 'rgb(1, 2, 3)';
      const fill = frame.locator('.lk-root .lk-job__fill').first();
      await fill.waitFor();
      const before = await fill.evaluate((el) => getComputedStyle(el).backgroundColor);
      if (before === OVERRIDE) throw new Error(`fill already computes ${OVERRIDE}`);

      const filter = page.getByLabel('Filter', { exact: true }).first();
      if (!(await filter.isVisible())) await page.getByText('CSS Vars', { exact: true }).first().click();
      await filter.fill('--wzl-accent');
      const row = page.getByRole('group', { name: '--wzl-accent', exact: true }).first();
      await row.getByRole('textbox').first().fill(OVERRIDE);

      await fill.evaluate(
        (el, want) =>
          new Promise((resolve, reject) => {
            const deadline = performance.now() + 5000;
            const poll = () => {
              const got = getComputedStyle(el).backgroundColor;
              if (got === want) resolve(got);
              else if (performance.now() > deadline) reject(new Error(`fill computes ${got}, not ${want}`));
              else setTimeout(poll, 50);
            };
            poll();
          }),
        OVERRIDE,
      );
    },
  },
  {
    id: 'labkit-primitives-jobprogress--determinate',
    what: 'lab-wide Mode reaching a labkit story, and a trial pin overriding it for that trial alone',
    // With the OS dark, `auto` starts every story dark, so light can only come from the toolbar.
    colorScheme: 'dark',
    check: async ({ page }) => {
      const trial = (name) => page.getByRole('region', { name: `Trial labkit/primitives/JobProgress / ${name}`, exact: true });
      /** Resolves once the trial's `.lk-root` is in `mode` and computes that mode's surface, not the other's. */
      const surfaceIs = (name, mode) =>
        trial(name)
          .frameLocator('iframe.fg-frame-view')
          .locator('.lk-root')
          .first()
          .evaluate(
            (el, want) =>
              new Promise((resolve, reject) => {
                const surfaceOf = (node) => getComputedStyle(node).getPropertyValue('--wzl-surface').trim();
                const probe = (probeMode) => {
                  const node = document.createElement('div');
                  node.setAttribute('data-wzl-theme', el.getAttribute('data-wzl-theme') ?? '');
                  node.setAttribute('data-wzl-mode', probeMode);
                  document.body.append(node);
                  const value = surfaceOf(node);
                  node.remove();
                  return value;
                };
                const other = want === 'light' ? 'dark' : 'light';
                const deadline = performance.now() + 5000;
                const poll = () => {
                  const got = { mode: el.getAttribute('data-wzl-mode'), surface: surfaceOf(el) };
                  if (got.mode === want && got.surface !== '' && got.surface === probe(want) && got.surface !== probe(other)) resolve(got);
                  else if (performance.now() > deadline) reject(new Error(`.lk-root is ${got.mode} with surface ${got.surface}, not ${want}`));
                  else setTimeout(poll, 50);
                };
                poll();
              }),
            mode,
          );

      await surfaceIs('Determinate', 'dark');
      await page.getByRole('toolbar', { name: 'Globals' }).getByLabel('Mode', { exact: true }).selectOption('light');
      await surfaceIs('Determinate', 'light');

      await page.evaluate(() => {
        location.hash = '#/labkit-primitives-jobprogress--indeterminate';
      });
      await trial('Indeterminate').frameLocator('iframe.fg-frame-view').locator('.lk-root').first().waitFor({ timeout: 20000 });
      await surfaceIs('Indeterminate', 'light');

      // labkit wraps the select in its row's <label>, so the option texts join the name.
      await trial('Determinate').getByLabel('Mode').selectOption('dark');
      await surfaceIs('Determinate', 'dark');
      await surfaceIs('Indeterminate', 'light');
    },
  },
];

const browser = await chromium.launch({ headless: true });
let failed = 0;
try {
  for (const [i, story] of stories.entries()) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ...(story.colorScheme ? { colorScheme: story.colorScheme } : {}),
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(`${origin}/#/${story.id}`);
      const frame = page.locator('iframe.fg-frame-view').first().contentFrame();
      await frame.locator(story.rendered ?? '.fg-frame > *').first().waitFor({ timeout: 20000 });
      await story.check({ page, frame });
      const faults = [
        ...(await page.locator('.fg-fault').allInnerTexts()),
        ...(await frame.locator('.fg-frame__fault').allInnerTexts()),
      ];
      if (faults.length > 0) throw new Error(`fault shown: ${faults.join(' | ')}`);
      if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`);
      const shot = `${shots}/forge-csf-${story.id}.png`;
      await page.screenshot({ path: shot });
      console.log(`${i + 1}/${stories.length} ${story.id}  ok  (${story.what}) ${shot}`);
    } catch (error) {
      failed += 1;
      console.log(`${i + 1}/${stories.length} ${story.id}  FAIL  ${error instanceof Error ? error.message.split('\n')[0] : error}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failed > 0) process.exit(1);
