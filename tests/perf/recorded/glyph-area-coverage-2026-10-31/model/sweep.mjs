import { render, stats, glyphH, font } from './glyphmodel.mjs';
const size = +process.argv[2]; const o = JSON.parse(process.argv[3] ?? '{}'); const qy0 = +(process.argv[4] ?? 5.40625);
const s = size / font.info.size; const st = [];
for (let k = 0; k < 16; k++) { const x = 4 + k / 16; st.push(stats(render(size, x + glyphH.xoffset * s, qy0, o), 32, x)); }
const offs = st.map((q) => q.off), ms = st.map((q) => q.mass);
console.log(JSON.stringify(o), 'swing', (Math.max(...offs) - Math.min(...offs)).toFixed(3), 'mass', Math.min(...ms).toFixed(2), Math.max(...ms).toFixed(2));
