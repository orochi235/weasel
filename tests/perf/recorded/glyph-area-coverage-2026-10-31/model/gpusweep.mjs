import fs from 'node:fs';
import { stats } from './glyphmodel.mjs';
for (const f of process.argv.slice(2)) {
  const rows = fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  for (const size of [7.2, 12, 16]) {
    const st = rows.filter((r) => r.size === size).map((r) => stats(Float64Array.from(r.red, (v) => v / 255), 32, r.x));
    const o = st.map((q) => q.off), m = st.map((q) => q.mass);
    const o8 = o.filter((_, i) => i % 2 === 0);
    console.log(f.padEnd(18), size, 'swing16', (Math.max(...o) - Math.min(...o)).toFixed(3), 'swing8', (Math.max(...o8) - Math.min(...o8)).toFixed(3), 'mass', Math.min(...m).toFixed(2), Math.max(...m).toFixed(2));
  }
}
