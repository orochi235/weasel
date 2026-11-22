import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(join(process.cwd(), 'package.json'));
const { chromium } = require('playwright-core');
const variants = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const ROUNDS = Number(process.argv[4] ?? 5);
const all = [];
for (let r = 0; r < ROUNDS; r++) {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
  try {
    const page = await browser.newPage();
    const res = await page.evaluate(async ({ variants, nonce }) => {
      const out = {};
      const names = Object.keys(variants).sort(() => Math.random() - 0.5);
      const MAIN = /\bvoid\s+main\s*\(\s*(?:void\s*)?\)/;
      for (const name of names) {
        const tag = 'cold_' + nonce + '_' + name.replace(/\W+/g, 'x');
        const cold = (s) => s.replace(MAIN, 'void ' + tag + '()') + '\nvoid main() { ' + tag + '(); }\n';
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2');
        const t0 = performance.now();
        const sh = [[gl.VERTEX_SHADER, variants[name].vert], [gl.FRAGMENT_SHADER, variants[name].frag]].map(([t, s]) => {
          const x = gl.createShader(t); gl.shaderSource(x, cold(s)); gl.compileShader(x); return x;
        });
        const p = gl.createProgram();
        for (const x of sh) gl.attachShader(p, x);
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(name + ' ' + gl.getProgramInfoLog(p) + sh.map((x) => gl.getShaderInfoLog(x)).join());
        out[name] = performance.now() - t0;
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        await new Promise((r) => setTimeout(r, 20));
      }
      return out;
    }, { variants, nonce: Math.random().toString(36).slice(2) });
    all.push(res);
    console.log(`${r + 1}/${ROUNDS} ` + Object.entries(res).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' | '));
  } finally { await browser.close(); }
}
const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const k of Object.keys(variants)) console.log(`${k.padEnd(22)} median ${med(all.map((a) => a[k])).toFixed(1).padStart(7)} ms`);
writeFileSync(process.argv[3], JSON.stringify({ rounds: all }, null, 1));
