// Headless check of the forge dev app: node apps/forge/e2e/smoke.mjs [url] [screenshot] [--profile=<dir>] [--expect-persisted]
// A second run with the same --profile and --expect-persisted checks that the trial survived a relaunch.
import { chromium } from '@playwright/test';
import ports from '../../../scripts/dev-ports.json' with { type: 'json' };

const args = process.argv.slice(2);
const [url = `http://[::1]:${ports.forge}/#/forge-counter--counter`, shot = 'forge-smoke.png'] = args.filter((a) => !a.startsWith('--'));
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

const total = persisted ? 2 : 5;
let step = 0;
const done = (what) => console.log(`${++step}/${total} ${what}`);

/** Whether labkit's default IndexedDB store holds a trial record with this config label and story state. */
const trialSaved = (label, n) =>
  page.evaluate(
    ({ label, n }) =>
      new Promise((resolve) => {
        const read = () => {
          const open = indexedDB.open('labkit');
          open.onerror = () => resolve(false);
          open.onsuccess = () => {
            const db = open.result;
            if (!db.objectStoreNames.contains('records')) {
              db.close();
              resolve(false);
              return;
            }
            const store = db.transaction('records').objectStore('records');
            const keys = store.getAllKeys();
            const values = store.getAll();
            values.onsuccess = () => {
              db.close();
              resolve(
                keys.result.some(
                  (key, i) =>
                    /^lk:[^:]+:trial:/.test(String(key)) &&
                    values.result[i]?.config?.label === label &&
                    values.result[i]?.state?.n === n,
                ),
              );
            };
            values.onerror = () => resolve(false);
          };
        };
        // Opening a database that does not exist yet creates it empty, and labkit's own open would then find no store.
        indexedDB.databases().then(
          (dbs) => (dbs.some((d) => d.name === 'labkit') ? read() : resolve(false)),
          () => resolve(false),
        );
      }),
    { label, n },
  );

try {
  await page.goto(url);
  // The story renders in the page, inside its trial's host element.
  const frame = page.locator('.fg-story[data-fg-host]').first();
  if (persisted) {
    await frame.getByRole('button', { name: 'taps: 1' }).waitFor({ timeout: 15000 });
    done('config and state survived a relaunch');
  } else {
    await frame.getByRole('button', { name: 'clicks: 0' }).waitFor({ timeout: 15000 });
    done('host rendered the story');
    await frame.getByRole('button').click();
    await frame.getByRole('button', { name: 'clicks: 1' }).waitFor();
    done('story state round-tripped');
    await page.getByRole('textbox').first().fill('taps');
    await frame.getByRole('button', { name: 'taps: 1' }).waitFor();
    done('control reached the story');
    // labkit writes records on a debounce; closing before the write lands loses them.
    const deadline = Date.now() + 5000;
    while (!(await trialSaved('taps', 1))) {
      if (Date.now() > deadline) throw new Error('the trial record never reached IndexedDB with label "taps" and n = 1');
      await page.waitForTimeout(100);
    }
    done('trial saved to IndexedDB');
  }
  await page.screenshot({ path: shot });
  done(`screenshot written to ${shot}`);
} finally {
  await context.close();
  await browser?.close();
  if (errors.length) console.error(errors.join('\n'));
}
if (errors.length) process.exit(1);
