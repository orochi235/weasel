// Does a program compiled on a throwaway context make the same source's link on another context fast?
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(join(process.cwd(), 'package.json'));
const { chromium } = require('playwright-core');
const variants = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const pick = { batch: variants.batch, area: variants.area };
const ROUNDS = Number(process.argv[4] ?? 5);
const all = [];
for (let r = 0; r < ROUNDS; r++) {
  for (const mode of ['none', 'warm-50', 'warm-50-flush', 'warm-100-flush', 'self-50-flush']) {
    const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
    try {
      const page = await browser.newPage();
      const res = await page.evaluate(async ({ pick, nonce, mode }) => {
        const MAIN = /\bvoid\s+main\s*\(\s*(?:void\s*)?\)/;
        const cold = (s, name) => s.replace(MAIN, 'void cold' + nonce + name + '()') + '\nvoid main() { cold' + nonce + name + '(); }\n';
        const start = (gl, name) => {
          const sh = [[gl.VERTEX_SHADER, pick[name].vert], [gl.FRAGMENT_SHADER, pick[name].frag]].map(([t, s]) => {
            const x = gl.createShader(t); gl.shaderSource(x, cold(s, name)); gl.compileShader(x); return x;
          });
          const p = gl.createProgram();
          for (const x of sh) gl.attachShader(p, x);
          gl.linkProgram(p);
          return p;
        };
        const ctx = () => document.createElement('canvas').getContext('webgl2');
        let warm = null;
        if (mode === 'self-50-flush') {
          const gl = ctx(); gl.getExtension('KHR_parallel_shader_compile');
          const ps = ['batch', 'area'].map((n) => start(gl, n));
          gl.flush();
          const t = performance.now(); while (performance.now() - t < 50) { /* app work */ }
          const t0 = performance.now();
          for (const p of ps) if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link');
          return performance.now() - t0;
        }
        if (mode !== 'none') {
          warm = ctx(); warm.getExtension('KHR_parallel_shader_compile');
          const ps = ['batch', 'area'].map((n) => start(warm, n));
          if (mode.endsWith('-flush')) warm.flush();
          const ms = mode.includes('100') ? 100 : 50;
          const t = performance.now(); while (performance.now() - t < ms) { /* app work */ }
        }
        const gl = ctx();
        gl.getExtension('KHR_parallel_shader_compile');
        const t0 = performance.now();
        const ps = ['batch', 'area'].map((n) => start(gl, n));
        for (const p of ps) if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link');
        return performance.now() - t0;
      }, { pick, nonce: Math.random().toString(36).slice(2), mode });
      all.push({ round: r, mode, ms: res });
      console.log(`${r + 1}/${ROUNDS} ${mode.padEnd(10)} second context links in ${res.toFixed(1)} ms`);
    } finally { await browser.close(); }
  }
}
writeFileSync(process.argv[3], JSON.stringify(all, null, 1));
