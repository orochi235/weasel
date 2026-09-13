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
];

const browser = await chromium.launch({ headless: true });
let failed = 0;
try {
  for (const [i, story] of stories.entries()) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(`${origin}/#/${story.id}`);
      const frame = page.frameLocator('iframe.fg-frame-view');
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
