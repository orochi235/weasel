// Drives a browser over the cursor probe page.
//
//   node probe.mjs <dir> [--browser chromium|webkit|firefox] [--headless]
//
// Headful (the default): for each cursor declaration it warps the OS pointer
// into the page and grabs a screencapture WITH the cursor (-C), which is the
// only way to see what the compositor actually rasterized. Takes the screen
// and the pointer for the duration.
//
// Headless: a headless browser draws no cursor, so this mode sees only what
// the engine does before rasterizing — whether it parses the declaration, and
// which image it fetches, at DPR 1 and DPR 2. It cannot see size caps, the
// rasterization scale, or the hotspot.
import { chromium, webkit, firefox } from 'playwright';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname } from 'node:path';

const DIR = process.argv[2];
const arg = (name) => process.argv.includes(name);
const opt = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? dflt : process.argv[i + 1];
};
const ENGINE = opt('--browser', 'chromium');
const TYPES = { chromium, webkit, firefox };
if (!TYPES[ENGINE]) throw new Error(`--browser must be one of ${Object.keys(TYPES).join(', ')}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (arg('--headless')) await headless();
else await headful();

async function headless() {
  const MIME = { '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    try {
      const body = readFileSync(`${DIR}${path}`);
      res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, '::', r));
  const base = `http://localhost:${server.address().port}`;
  const browser = await TYPES[ENGINE].launch({ headless: true });
  const version = browser.version();
  const results = [];
  try {
    for (const dpr of [1, 2]) {
      const context = await browser.newContext({ deviceScaleFactor: dpr });
      const page = await context.newPage();
      const fetched = [];
      page.on('request', (r) => {
        const u = new URL(r.url());
        if (u.pathname.startsWith('/assets/')) fetched.push(`${u.pathname.slice(8)}?${u.search.slice(1)}`);
      });
      await page.goto(`${base}/cursor-probe-http.html`);
      const ids = await page.evaluate(() => window.__cases);
      for (let i = 0; i < ids.length; i++) {
        const r = await page.evaluate((n) => {
          const out = window.__setCase(n);
          const css = getComputedStyle(document.getElementById('stage')).cursor;
          return { ...out, supports: CSS.supports('cursor', document.getElementById('stage').style.cursor || 'x'), computed: css };
        }, i);
        // The engine may defer the fetch until the cursor is actually needed.
        await page.mouse.move(290, 290);
        await page.mouse.move(300, 300);
        await sleep(250);
        const mine = fetched.filter((f) => f.endsWith(`?${r.id}`)).map((f) => f.split('?')[0]);
        results.push({ dpr, id: r.id, accepted: r.accepted, fetched: mine, computed: r.computed });
        console.log(`dpr${dpr} ${i + 1}/${ids.length}  ${r.id.padEnd(10)} accepted=${String(r.accepted).padEnd(5)}  fetched=${mine.join(',') || '-'}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  const out = `${DIR}/probe-results-${ENGINE}-headless.json`;
  writeFileSync(out, JSON.stringify({ engine: ENGINE, version, results }, null, 2));
  console.log(`${ENGINE} ${version} done ->`, out);
}

async function headful() {
  // The OS app each engine runs as, so it can be brought to the front.
  // Only the chromium path has been run; the other two names are unverified.
  const APP = { chromium: 'Google Chrome', webkit: 'Playwright', firefox: 'Nightly' };
  const SHOTS = `${DIR}/shots-${ENGINE}`;
  mkdirSync(SHOTS, { recursive: true });
  const warp = (x, y) => execFileSync(`${DIR}/warp`, [String(x), String(y)]);
  const grab = (x, y, w, h, out) =>
    execFileSync('screencapture', ['-x', '-C', '-R', `${x},${y},${w},${h}`, out]);

  const browser = await TYPES[ENGINE].launch({
    headless: false,
    ...(ENGINE === 'chromium'
      ? { channel: 'chrome', args: ['--window-position=60,60', '--window-size=900,700'] }
      : {}),
  });
  const page = await browser.newPage(ENGINE === 'chromium' ? { viewport: null } : { viewport: { width: 900, height: 600 } });
  await page.goto(`file://${DIR}/cursor-probe.html`);
  await sleep(700);
  await page.bringToFront();
  execFileSync('osascript', ['-e', `tell application "${APP[ENGINE]}" to activate`]);
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
    // Warp twice so the browser definitely sees a move and re-evaluates the cursor.
    warp(originX + PX - 6, originY + PY - 6);
    await sleep(90);
    warp(originX + PX, originY + PY);
    await sleep(260);
    const out = `${SHOTS}/${String(i).padStart(2, '0')}-${r.id}.png`;
    grab(originX + PX - 30, originY + PY - 30, BOX, BOX, out);
    results.push({ ...r, shot: out });
    console.log(`${i + 1}/${ids.length}  ${r.id.padEnd(10)} accepted=${r.accepted}  ${r.label}`);
  }

  writeFileSync(`${DIR}/probe-results-${ENGINE}.json`, JSON.stringify({ geom, results }, null, 2));
  await browser.close();
  console.log('done ->', `${DIR}/probe-results-${ENGINE}.json`);
}
