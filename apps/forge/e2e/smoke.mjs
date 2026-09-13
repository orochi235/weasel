// Headless check of the forge dev app: node apps/forge/e2e/smoke.mjs [url] [screenshot] [--profile=<dir>] [--expect-persisted]
// A second run with the same --profile and --expect-persisted checks that the trial survived a relaunch.
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const [url = 'http://[::1]:5178/#/forge-counter--counter', shot = 'forge-smoke.png'] = args.filter((a) => !a.startsWith('--'));
const profile = args.find((a) => a.startsWith('--profile='))?.slice('--profile='.length);
const persisted = args.includes('--expect-persisted');
const viewport = { width: 1280, height: 800 };

const browser = profile ? null : await chromium.launch({ headless: true });
const context = profile
  ? await chromium.launchPersistentContext(profile, { headless: true, viewport })
  : await browser.newContext({ viewport });
const page = context.pages()[0] ?? (await context.newPage());
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const total = persisted ? 2 : 4;
let step = 0;
const done = (what) => console.log(`${++step}/${total} ${what}`);

await page.goto(url);
const frame = page.frameLocator('iframe.fg-frame-view');
if (persisted) {
  await frame.getByRole('button', { name: 'taps: 1' }).waitFor({ timeout: 15000 });
  done('config and state survived a relaunch');
} else {
  await frame.getByRole('button', { name: 'clicks: 0' }).waitFor({ timeout: 15000 });
  done('frame rendered the story');
  await frame.getByRole('button').click();
  await frame.getByRole('button', { name: 'clicks: 1' }).waitFor();
  done('story state round-tripped');
  await page.getByRole('textbox').first().fill('taps');
  await frame.getByRole('button', { name: 'taps: 1' }).waitFor();
  done('control reached the frame');
  // labkit writes records to IndexedDB on a 300 ms debounce; closing sooner loses them.
  await page.waitForTimeout(1000);
}
await page.screenshot({ path: shot });
done(`screenshot written to ${shot}`);
await context.close();
await browser?.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
