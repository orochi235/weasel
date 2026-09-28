// Builds the cursor test corpus: the same pencil glyph as SVG data URIs and as
// resvg-rasterized PNGs at several sizes, then an HTML harness that can switch
// the page cursor between them one at a time.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const DIR = process.argv[2];
const BODY = 'M 3 17 L 5.5 14.5 L 14 6 L 17 9 L 8.5 17.5 L 6 17 Z';
const FERRULE = 'M 12 4 L 17 9';
const INK = '#141418';

// Register C from the proof: filled silhouette, white halo behind.
const glyph = () => `
  <g paint-order="stroke fill">
    <path d="${BODY}" fill="${INK}" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="${FERRULE}" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
  </g>`;

// viewBox is 0 0 20 20 but the halo bleeds half a stroke past the edge, so the
// box is grown by 2 units on every side and the glyph offset to match.
const PAD = 2;
const VB = 20 + PAD * 2;
const svg = (px) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${VB} ${VB}">` +
  `<g transform="translate(${PAD},${PAD})">${glyph()}</g></svg>`;

// Hotspot: pencil tip at glyph (3,17) -> padded (5,19) -> scaled to px, rounded.
const hotspot = (px) => [Math.round((5 / VB) * px), Math.round((19 / VB) * px)];

// Every asset is written to assets/ and referenced two ways: inline as a data
// URI (cursor-probe.html, for the headful capture) and by relative path
// (cursor-probe-http.html, for the headless run, which can only see what the
// engine chose to fetch).
mkdirSync(`${DIR}/assets`, { recursive: true });
const asset = (name, mime, bytes) => {
  writeFileSync(`${DIR}/assets/${name}`, bytes);
  // SVG stays percent-encoded, the form bake.ts emits and Chrome was measured on.
  const data = mime === 'image/svg+xml'
    ? `data:${mime},${encodeURIComponent(bytes)}`
    : `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
  return { data: `url("${data}")`,
           http: `url("assets/${name}")` };
};
const svgRef = (px) => asset(`g${px}.svg`, 'image/svg+xml', svg(px));
const pngRef = (px) => {
  const s = `${DIR}/assets/_g${px}.svg`, p = `${DIR}/assets/g${px}.png`;
  writeFileSync(s, svg(px));
  execFileSync('resvg', ['-w', String(px), '-h', String(px), s, p]);
  return asset(`g${px}.png`, 'image/png', readFileSync(p));
};
const iset = (a, b) => ({ data: `image-set(${a.data} 1x, ${b.data} 2x)`,
                          http: `image-set(${a.http} 1x, ${b.http} 2x)` });

// Each case is [id, label, {data, http} cursor value without hotspot or
// fallback, hotspotPx, fallback]. hotspotPx is the size (CSS px) the hotspot
// is computed against. An empty fallback omits the comma and keyword.
const CASES = [
  ['svg24',      'SVG, width/height=24',                      svgRef(24), 24],
  ['svg48',      'SVG, width/height=48',                      svgRef(48), 48],
  ['png24',      'PNG 24x24',                                 pngRef(24), 24],
  ['png48',      'PNG 48x48 (is image px == CSS px?)',        pngRef(48), 48],
  ['iset',       'image-set(png24 1x, png48 2x)',             iset(pngRef(24), pngRef(48)), 24],
  ['isetsvg',    'image-set(svg24 1x, svg48 2x)',             iset(svgRef(24), svgRef(48)), 24],
  ['png128',     'PNG 128x128 (at the documented cap)',       pngRef(128), 128],
  ['png160',     'PNG 160x160 (over the cap?)',               pngRef(160), 160],
  ['png256',     'PNG 256x256 (well over)',                   pngRef(256), 256],
  ['svg160',     'SVG 160x160 (over the cap?)',               svgRef(160), 160],
  ['nofallback', 'SVG 24, no keyword fallback',               svgRef(24), 24, ''],
];

const decls = (form) => CASES.map(([id, label, val, hp, fb = 'crosshair']) => {
  const [hx, hy] = hotspot(hp);
  // Tag each fetch with its case so the headless run can attribute requests.
  const v = form === 'http' ? val.http.replace(/(url\("assets\/[^"]+)"\)/g, `$1?${id}")`) : val.data;
  return { id, label, css: `${v} ${hx} ${hy}${fb ? `, ${fb}` : ''}` };
});

const page = (form) => `<!doctype html><meta charset="utf-8"><title>cursor probe</title>
<style>
  html,body{margin:0;height:100%}
  #stage{position:fixed;inset:0;background:#6f7d8c;cursor:crosshair}
  #hud{position:fixed;left:8px;top:8px;font:12px ui-monospace,monospace;color:#fff;
       background:#0008;padding:6px 8px;border-radius:4px;pointer-events:none}
</style>
<div id="stage"></div><div id="hud"></div>
<script>
const CASES = ${JSON.stringify(decls(form))};
const stage = document.getElementById('stage');
const hud = document.getElementById('hud');
window.__setCase = (i) => {
  const c = CASES[i];
  stage.style.cursor = '';
  stage.style.cursor = c.css;
  // If the browser rejected the whole declaration the inline style is empty.
  const accepted = stage.style.cursor !== '';
  hud.textContent = c.id + '  |  accepted=' + accepted + '  |  dpr=' + devicePixelRatio;
  return { id: c.id, label: c.label, accepted, computed: getComputedStyle(stage).cursor.slice(0, 60) };
};
window.__geom = () => ({
  screenX: window.screenX, screenY: window.screenY,
  outerH: window.outerHeight, innerH: window.innerHeight,
  innerW: window.innerWidth, dpr: devicePixelRatio,
});
window.__cases = CASES.map(c => c.id);
</script>`;
writeFileSync(`${DIR}/cursor-probe.html`, page('data'));
writeFileSync(`${DIR}/cursor-probe-http.html`, page('http'));
console.log(`wrote cursor-probe.html and cursor-probe-http.html with ${CASES.length} cases`);
