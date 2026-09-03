// Builds the cursor test corpus: the same pencil glyph as SVG data URIs and as
// resvg-rasterized PNGs at several sizes, then an HTML harness that can switch
// the page cursor between them one at a time.
import { writeFileSync, readFileSync } from 'node:fs';
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

const svgUri = (px) => `url("data:image/svg+xml,${encodeURIComponent(svg(px))}")`;

const pngUri = (px) => {
  const s = `${DIR}/_g${px}.svg`, p = `${DIR}/_g${px}.png`;
  writeFileSync(s, svg(px));
  execFileSync('resvg', ['-w', String(px), '-h', String(px), s, p]);
  return `url("data:image/png;base64,${readFileSync(p).toString('base64')}")`;
};

// Each case is [id, label, cursor-value-without-hotspot-or-fallback, hotspotPx]
// hotspotPx is the size the hotspot should be computed against (CSS px).
const CASES = [
  ['svg24',      'SVG data URI, width/height=24',            svgUri(24), 24],
  ['svg48',      'SVG data URI, width/height=48',            svgUri(48), 48],
  ['png24',      'PNG 24x24',                                pngUri(24), 24],
  ['png48',      'PNG 48x48 (is image px == CSS px?)',        pngUri(48), 48],
  ['iset',       'image-set(png24 1x, png48 2x)',
     `image-set(${pngUri(24)} 1x, ${pngUri(48)} 2x)`, 24],
  ['isetsvg',    'image-set(svg24 1x, svg48 2x)',
     `image-set(${svgUri(24)} 1x, ${svgUri(48)} 2x)`, 24],
  ['png128',     'PNG 128x128 (at the documented cap)',      pngUri(128), 128],
  ['png160',     'PNG 160x160 (over the cap?)',              pngUri(160), 160],
  ['png256',     'PNG 256x256 (well over)',                  pngUri(256), 256],
  ['svg160',     'SVG 160x160 (over the cap?)',              svgUri(160), 160],
];

const decls = CASES.map(([id, label, val, hp]) => {
  const [hx, hy] = hotspot(hp);
  return { id, label, css: `${val} ${hx} ${hy}, crosshair` };
});

const html = `<!doctype html><meta charset="utf-8"><title>cursor probe</title>
<style>
  html,body{margin:0;height:100%}
  #stage{position:fixed;inset:0;background:#6f7d8c;cursor:crosshair}
  #hud{position:fixed;left:8px;top:8px;font:12px ui-monospace,monospace;color:#fff;
       background:#0008;padding:6px 8px;border-radius:4px;pointer-events:none}
</style>
<div id="stage"></div><div id="hud"></div>
<script>
const CASES = ${JSON.stringify(decls)};
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
writeFileSync(`${DIR}/cursor-probe.html`, html);
console.log(`wrote cursor-probe.html with ${CASES.length} cases`);
