// Drives real Chrome over the cursor probe page. For each cursor declaration it
// warps the OS pointer into the page and grabs a screencapture WITH the cursor
// (-C), which is the only way to see what the compositor actually rasterized.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const DIR = process.argv[2];
const SHOTS = `${DIR}/shots`;
mkdirSync(SHOTS, { recursive: true });
const warp = (x, y) => execFileSync(`${DIR}/warp`, [String(x), String(y)]);
const grab = (x, y, w, h, out) =>
  execFileSync('screencapture', ['-x', '-C', '-R', `${x},${y},${w},${h}`, out]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: false, channel: 'chrome',
  args: ['--window-position=60,60', '--window-size=900,700'] });
const page = await browser.newPage({ viewport: null });
await page.goto(`file://${DIR}/cursor-probe.html`);
await sleep(700);
execFileSync('osascript', ['-e', 'tell application "Google Chrome" to activate']);
await sleep(600);

const geom = await page.evaluate(() => window.__geom());
const ids = await page.evaluate(() => window.__cases);
console.log('geom', JSON.stringify(geom));

// Page (0,0) in screen points. outerH-innerH is the browser chrome above the viewport.
const originX = geom.screenX;
const originY = geom.screenY + (geom.outerH - geom.innerH);
const PX = 300, PY = 300;           // where in the page to park the pointer
const BOX = 150;                    // capture box side, in points
const results = [];

for (let i = 0; i < ids.length; i++) {
  const r = await page.evaluate((n) => window.__setCase(n), i);
  await sleep(120);
  // Warp twice so Chrome definitely sees a move and re-evaluates the cursor.
  warp(originX + PX - 6, originY + PY - 6);
  await sleep(90);
  warp(originX + PX, originY + PY);
  await sleep(260);
  const out = `${SHOTS}/${String(i).padStart(2, '0')}-${r.id}.png`;
  grab(originX + PX - 30, originY + PY - 30, BOX, BOX, out);
  results.push({ ...r, shot: out });
  console.log(`${i + 1}/${ids.length}  ${r.id.padEnd(10)} accepted=${r.accepted}  ${r.label}`);
}

writeFileSync(`${DIR}/probe-results.json`, JSON.stringify({ geom, results }, null, 2));
await browser.close();
console.log('done ->', `${DIR}/probe-results.json`);
