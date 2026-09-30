// Drives a browser over the cursor probe page.
//
//   node probe.mjs <dir> [--browser chromium|webkit|firefox|safari] [--headless]
//
// Headful (the default): for each cursor declaration it warps the OS pointer
// into the page and grabs a screencapture WITH the cursor (-C), which is the
// only way to see what the compositor actually rasterized. Takes the screen
// and the pointer for the duration.
//
// Safari (headful only): Playwright cannot drive it, so the page is opened with
// `open -a Safari` and stepped by setting the tab URL's #case=<n> from
// AppleScript, which needs no "Allow JavaScript from Apple Events".
//
// Headless: a headless browser draws no cursor, so this mode sees only what
// the engine does before rasterizing — whether it parses the declaration, and
// which image it fetches, at DPR 1 and DPR 2. It cannot see size caps, the
// rasterization scale, or the hotspot.
import { chromium, webkit, firefox } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = process.argv[2];
const arg = (name) => process.argv.includes(name);
const opt = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? dflt : process.argv[i + 1];
};
const ENGINE = opt('--browser', 'chromium');
const TYPES = { chromium, webkit, firefox };
if (!TYPES[ENGINE] && ENGINE !== 'safari') throw new Error('--browser must be one of chromium, webkit, firefox, safari');
if (ENGINE === 'safari' && arg('--headless')) throw new Error('Safari has no headless mode');
// Built beside this script (README), not in the scratch <dir>.
const WARP = fileURLToPath(new URL('./warp', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (arg('--headless')) await headless();
else await headful();

/** `<dir>` over HTTP on a free port, for a page whose cursors are `url()`s. */
async function serve() {
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
  return { base: `http://localhost:${server.address().port}`, close: () => server.close() };
}

async function headless() {
  const server = await serve();
  const { base } = server;
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
  // An idle Mac's display sleeps, and a sleeping display captures black — or,
  // dimmed, captures the page with no pointer drawn. Declaring user activity
  // wakes it and holds it for the run.
  const awake = spawn('caffeinate', ['-u', '-d'], { stdio: 'ignore' });
  awake.unref();
  process.on('exit', () => awake.kill());
  await sleep(1000);
  // Nothing fails loudly without these: captures come back blank and posted
  // moves vanish. Check before taking the screen.
  try {
    execFileSync(WARP, ['check'], { stdio: 'inherit' });
  } catch {
    console.error('headful probe needs an unlocked screen, and Screen Recording and Accessibility for the app running it');
    process.exit(2);
  }
  // `--page http` serves the `url()` form of the page instead of opening the
  // `data:` one from disk, to tell a refused data URI from a refused image.
  const server = opt('--page', 'data') === 'http' ? await serve() : null;
  const tag = server ? `${ENGINE}-http` : ENGINE;
  const SHOTS = `${DIR}/shots-${tag}`;
  mkdirSync(SHOTS, { recursive: true });
  const warp = (x, y) => execFileSync(WARP, [String(x), String(y)]);
  const grab = (x, y, w, h, out) =>
    execFileSync('screencapture', ['-x', '-C', '-R', `${x},${y},${w},${h}`, out]);
  const md5 = (f) => createHash('md5').update(readFileSync(f)).digest('hex');

  const pageUrl = server ? `${server.base}/cursor-probe-http.html` : `file://${DIR}/cursor-probe.html`;
  const driver = ENGINE === 'safari' ? await safariDriver(pageUrl) : await playwrightDriver(pageUrl);
  const { ids, geom, originX, originY, PX, PY } = driver;
  console.log('geom', JSON.stringify(geom));
  if (geom.dpr != null && geom.dpr < 2) console.warn(`devicePixelRatio is ${geom.dpr}: this is not a 2x measurement`);
  const BOX = 150;                    // capture box side, in points
  const results = [];

  const capture = async (i, name) => {
    const r = await driver.setCase(i);
    await sleep(300);
    // Several spaced moves: Firefox drops a cursor change that arrives with
    // only one or two events close together.
    for (const d of [8, 4, 0]) {
      warp(originX + PX - d, originY + PY - d);
      await sleep(150);
    }
    await sleep(600);
    const out = `${SHOTS}/${name}.png`;
    grab(originX + PX - 30, originY + PY - 30, BOX, BOX, out);
    return { ...r, shot: out, md5: md5(out) };
  };

  try {
    for (let i = 0; i < ids.length; i++) {
      const r = await capture(i, `${String(i).padStart(2, '0')}-${ids[i]}`);
      results.push(r);
      console.log(`${i + 1}/${ids.length}  ${r.id.padEnd(10)} accepted=${r.accepted}  ${r.md5.slice(0, 8)}  ${r.label}`);
      // Cases 0 and 1 are the default arrow and a bare crosshair. Until they
      // differ the browser is not driving the cursor, and nothing after them
      // can be trusted.
      if (i === 1 && results[0].md5 === results[1].md5) {
        throw new Error('control failed: the crosshair case captured the same as the arrow case');
      }
    }
    // Re-run the crosshair at the end: a browser that lost focus mid-run
    // captures the arrow here instead.
    const again = await capture(1, `zz-${ids[1]}-again`);
    if (again.md5 !== results[1].md5) throw new Error('control failed: the crosshair changed between the start and the end of the run');
  } finally {
    writeFileSync(`${DIR}/probe-results-${tag}.json`, JSON.stringify({ geom, results }, null, 2));
    await driver.close();
    server?.close();
  }
  console.log('done ->', `${DIR}/probe-results-${tag}.json`);
}

async function playwrightDriver(pageUrl) {
  // Activated by pid: activating Playwright's Firefox by its app name (`Nightly`)
  // leaves it in the background, and macOS then draws its own arrow over the page.
  const PROCESS = {
    chromium: 'Google Chrome.app/Contents/MacOS/Google Chrome',
    webkit: 'ms-playwright/webkit-.*/Playwright.app/Contents/MacOS/Playwright',
    firefox: 'ms-playwright/firefox-.*/Nightly.app/Contents/MacOS/firefox',
  };
  const browser = await TYPES[ENGINE].launch({
    headless: false,
    ...(ENGINE === 'chromium'
      ? { channel: 'chrome', args: ['--window-position=60,60', '--window-size=900,700'] }
      : {}),
  });
  // A fixed viewport pins devicePixelRatio to 1 whatever the screen is.
  const page = await browser.newPage({ viewport: null });
  await page.goto(pageUrl);
  await sleep(700);
  await page.bringToFront();
  const pid = execFileSync('pgrep', ['-n', '-f', PROCESS[ENGINE]], { encoding: 'utf8' }).trim();
  execFileSync('osascript', ['-e',
    `tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true`]);
  await sleep(600);
  const geom = await page.evaluate(() => window.__geom());
  return {
    geom,
    ids: await page.evaluate(() => window.__cases),
    // Page (0,0) in screen points. outerH-innerH is the browser chrome above the viewport.
    originX: geom.screenX,
    originY: geom.screenY + (geom.outerH - geom.innerH),
    PX: 300, PY: 300,
    setCase: (i) => page.evaluate((n) => window.__setCase(n), i),
    close: () => browser.close(),
  };
}

async function safariDriver(pageUrl) {
  const osa = (script) => execFileSync('osascript', ['-e', script], { encoding: 'utf8' }).trim();
  const cases = JSON.parse(readFileSync(`${DIR}/cases.json`, 'utf8'));
  const url = (i) => `${pageUrl}#case=${i}`;
  let wasRunning = true;
  try { execFileSync('pgrep', ['-x', 'Safari']); } catch { wasRunning = false; }
  // A window left by an interrupted run would be the one stepped and measured.
  if (wasRunning) {
    try { osa('tell application "Safari" to close (every window whose name is "cursor probe")'); } catch { /* none open */ }
  }
  execFileSync('open', ['-a', 'Safari', url(0)]);
  await sleep(1500);
  osa('tell application "Safari" to set bounds of front window to {60, 60, 960, 760}');
  osa('tell application "Safari" to activate');
  await sleep(800);
  // The page is a full-window stage, so any point well inside the window works;
  // its origin cannot be read from JS here, and does not need to be.
  const [x1, y1, x2, y2] = osa('tell application "Safari" to get bounds of front window').split(/,\s*/).map(Number);
  const geom = { bounds: [x1, y1, x2, y2], dpr: null };
  return {
    geom,
    ids: cases.map((c) => c.id),
    originX: 0, originY: 0,
    PX: Math.round((x1 + x2) / 2), PY: Math.round(y1 + (y2 - y1) * 0.6),
    setCase: async (i) => {
      osa(`tell application "Safari" to set URL of current tab of front window to "${url(i)}"`);
      osa('tell application "Safari" to activate');
      return { id: cases[i].id, label: cases[i].label, accepted: null };
    },
    close: async () => {
      if (wasRunning) osa('tell application "Safari" to close front window');
      else osa('tell application "Safari" to quit');
    },
  };
}
